import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";

export const runtime =
  "nodejs";

type MercadoPagoPaymentMethod = {
  id?: string;
  type?: string;
  ticket_url?: string;
  qr_code?: string;
  qr_code_base64?: string;
};

type MercadoPagoPayment = {
  id?: string;
  status?: string;
  status_detail?: string;
  amount?: string;
  payment_method?: MercadoPagoPaymentMethod;
};

type MercadoPagoOrderResponse = {
  id?: string;
  status?: string;
  status_detail?: string;
  external_reference?: string;
  total_amount?: string;

  transactions?: {
    payments?: MercadoPagoPayment[];
  };

  message?: string;
  error?: string;
  errors?: unknown;
};

type FulfillmentMethod =
  | "delivery"
  | "pickup";

type OrderRow = {
  id: string;
  customer_id: string;

  restaurant_id: string;

  fulfillment_method:
    | FulfillmentMethod
    | null;

  payment_method:
    | string
    | null;

  payment_status:
    string;

  status:
    string;

  total:
    | number
    | string;
};

type RestaurantOpenStatus = {
  is_open: boolean;

  current_day:
    | number
    | null;

  opens_at:
    | string
    | null;

  closes_at:
    | string
    | null;

  next_day:
    | number
    | null;

  next_opens_at:
    | string
    | null;
};

type RestaurantOrderOptions = {
  delivery_available:
    boolean;

  pickup_available:
    boolean;
};

function jsonError(
  message: string,
  status: number,
  extra?: Record<
    string,
    unknown
  >
) {
  return NextResponse.json(
    {
      ok: false,

      error:
        message,

      ...(
        extra ??
        {}
      ),
    },
    {
      status,
    }
  );
}

export async function POST(
  request: NextRequest
) {
  try {
    // ==========================================
    // CONFIGURAÇÕES
    // ==========================================

    const mercadoPagoAccessToken =
      process.env
        .MERCADO_PAGO_ACCESS_TOKEN;

    const mercadoPagoTestMode =
      process.env
        .MERCADO_PAGO_TEST_MODE;

    const supabaseUrl =
      process.env
        .NEXT_PUBLIC_SUPABASE_URL;

    const supabaseKey =
      process.env
        .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (
      !mercadoPagoAccessToken
    ) {
      return jsonError(
        "MERCADO_PAGO_ACCESS_TOKEN_NOT_CONFIGURED",
        500
      );
    }

    if (
      mercadoPagoTestMode !==
        "true" &&
      mercadoPagoTestMode !==
        "false"
    ) {
      return jsonError(
        "MERCADO_PAGO_TEST_MODE_NOT_CONFIGURED",
        500
      );
    }

    if (
      !supabaseUrl ||
      !supabaseKey
    ) {
      return jsonError(
        "SUPABASE_SERVER_CONFIG_NOT_FOUND",
        500
      );
    }

    // ==========================================
    // AUTENTICAÇÃO
    // ==========================================

    const authorization =
      request.headers.get(
        "authorization"
      );

    if (
      !authorization ||
      !authorization.startsWith(
        "Bearer "
      )
    ) {
      return jsonError(
        "NOT_AUTHENTICATED",
        401
      );
    }

    const accessToken =
      authorization
        .slice(
          "Bearer ".length
        )
        .trim();

    if (
      !accessToken
    ) {
      return jsonError(
        "NOT_AUTHENTICATED",
        401
      );
    }

    const supabase =
      createClient(
        supabaseUrl,
        supabaseKey,
        {
          auth: {
            persistSession:
              false,

            autoRefreshToken:
              false,
          },

          global: {
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          },
        }
      );

    const {
      data:
        userData,

      error:
        userError,
    } =
      await supabase.auth
        .getUser(
          accessToken
        );

    if (
      userError ||
      !userData.user
    ) {
      return jsonError(
        "INVALID_SESSION",
        401
      );
    }

    // ==========================================
    // BODY
    // ==========================================

    let body: {
      orderId?: string;
    };

    try {
      body =
        await request.json();
    } catch {
      return jsonError(
        "INVALID_JSON",
        400
      );
    }

    const orderId =
      String(
        body.orderId ??
          ""
      ).trim();

    if (
      !orderId
    ) {
      return jsonError(
        "ORDER_ID_REQUIRED",
        400
      );
    }

    // ==========================================
    // BUSCAR PEDIDO
    // ==========================================

    const {
      data:
        orderData,

      error:
        orderError,
    } =
      await supabase
        .from(
          "orders"
        )
        .select(`
          id,
          customer_id,
          restaurant_id,
          fulfillment_method,
          payment_method,
          payment_status,
          status,
          total
        `)
        .eq(
          "id",
          orderId
        )
        .eq(
          "customer_id",
          userData.user.id
        )
        .maybeSingle();

    if (
      orderError ||
      !orderData
    ) {
      console.error(
        "Erro buscando pedido para PIX:",
        orderError
      );

      return jsonError(
        "ORDER_NOT_FOUND",
        404
      );
    }

    const order =
      orderData as OrderRow;

    // ==========================================
    // PEDIDO JÁ PAGO
    // ==========================================

    if (
      order.payment_status ===
      "paid"
    ) {
      return NextResponse.json({
        ok: true,

        alreadyPaid:
          true,

        orderId:
          order.id,
      });
    }

    // ==========================================
    // PEDIDO CANCELADO / FINALIZADO
    // ==========================================

    if (
      order.status ===
        "cancelled" ||
      order.status ===
        "delivered"
    ) {
      return jsonError(
        "ORDER_NOT_PAYABLE",
        409,
        {
          orderStatus:
            order.status,
        }
      );
    }

    // ==========================================
    // PAGAMENTO PRECISA ESTAR PENDENTE
    // ==========================================

    if (
      order.payment_status !==
      "pending"
    ) {
      return jsonError(
        "ORDER_PAYMENT_NOT_PENDING",
        409,
        {
          paymentStatus:
            order.payment_status,
        }
      );
    }

    // ==========================================
    // PRECISA SER PIX
    // ==========================================

    if (
      order.payment_method !==
      "pix"
    ) {
      return jsonError(
        "ORDER_IS_NOT_PIX",
        409
      );
    }

    // ==========================================
    // RESTAURANTE
    // ==========================================

    if (
      !order.restaurant_id
    ) {
      return jsonError(
        "RESTAURANT_NOT_FOUND",
        404
      );
    }

    // ==========================================
    // VERIFICAR HORÁRIO DA LOJA
    //
    // IMPORTANTE:
    // ESTA VERIFICAÇÃO ACONTECE NO SERVIDOR.
    //
    // NÃO ADIANTA O CLIENTE ALTERAR O SITE
    // OU CHAMAR A API MANUALMENTE.
    // ==========================================

    const {
      data:
        openStatusData,

      error:
        openStatusError,
    } =
      await supabase.rpc(
        "get_restaurant_open_status",
        {
          p_restaurant_id:
            order.restaurant_id,
        }
      );

    if (
      openStatusError
    ) {
      console.error(
        "Erro verificando horário da loja antes do PIX:",
        openStatusError
      );

      return jsonError(
        "RESTAURANT_STATUS_CHECK_FAILED",
        503
      );
    }

    const openStatus =
      Array.isArray(
        openStatusData
      ) &&
      openStatusData.length >
        0
        ? (
            openStatusData[0] as RestaurantOpenStatus
          )
        : null;

    if (
      !openStatus
    ) {
      return jsonError(
        "RESTAURANT_STATUS_CHECK_FAILED",
        503
      );
    }

    // ==========================================
    // LOJA FECHADA
    //
    // NÃO CRIA COBRANÇA PIX.
    // ==========================================

    if (
      openStatus.is_open !==
      true
    ) {
      return jsonError(
        "RESTAURANT_CLOSED",
        409,
        {
          nextDay:
            openStatus.next_day,

          nextOpensAt:
            openStatus.next_opens_at,
        }
      );
    }

    // ==========================================
    // VERIFICAR ENTREGA / RETIRADA
    // ==========================================

    const {
      data:
        orderOptionsData,

      error:
        orderOptionsError,
    } =
      await supabase.rpc(
        "get_restaurant_order_options",
        {
          p_restaurant_id:
            order.restaurant_id,
        }
      );

    if (
      orderOptionsError
    ) {
      console.error(
        "Erro verificando modalidades da loja antes do PIX:",
        orderOptionsError
      );

      return jsonError(
        "RESTAURANT_ORDER_OPTIONS_CHECK_FAILED",
        503
      );
    }

    const orderOptions =
      Array.isArray(
        orderOptionsData
      ) &&
      orderOptionsData.length >
        0
        ? (
            orderOptionsData[0] as RestaurantOrderOptions
          )
        : null;

    if (
      !orderOptions
    ) {
      return jsonError(
        "RESTAURANT_ORDER_OPTIONS_CHECK_FAILED",
        503
      );
    }

    // ==========================================
    // TIPO DO PEDIDO
    //
    // PEDIDOS ANTIGOS SEM fulfillment_method
    // SÃO TRATADOS COMO ENTREGA.
    // ==========================================

    const fulfillmentMethod:
      FulfillmentMethod =
      order.fulfillment_method ===
      "pickup"
        ? "pickup"
        : "delivery";

    // ==========================================
    // ENTREGA PAUSADA
    // ==========================================

    if (
      fulfillmentMethod ===
        "delivery" &&
      orderOptions
        .delivery_available !==
        true
    ) {
      return jsonError(
        "RESTAURANT_DELIVERY_PAUSED",
        409
      );
    }

    // ==========================================
    // RETIRADA PAUSADA
    // ==========================================

    if (
      fulfillmentMethod ===
        "pickup" &&
      orderOptions
        .pickup_available !==
        true
    ) {
      return jsonError(
        "RESTAURANT_PICKUP_PAUSED",
        409
      );
    }

    // ==========================================
    // VALOR
    // ==========================================

    const amount =
      Number(
        order.total
      );

    if (
      !Number.isFinite(
        amount
      ) ||
      amount <=
        0
    ) {
      return jsonError(
        "INVALID_ORDER_TOTAL",
        409
      );
    }

    const isTestMode =
      mercadoPagoTestMode ===
      "true";

    // ==========================================
    // REGRA DO TESTE OFICIAL PIX
    // ==========================================

    if (
      isTestMode &&
      Math.abs(
        amount -
          50
      ) >
        0.001
    ) {
      return jsonError(
        "TEST_PIX_REQUIRES_TOTAL_50",
        409,
        {
          currentTotal:
            amount.toFixed(
              2
            ),

          requiredTotal:
            "50.00",
        }
      );
    }

    // ==========================================
    // PAGADOR
    // ==========================================

    const payerEmail =
      isTestMode
        ? "test_user_br@testuser.com"
        : userData.user.email;

    if (
      !payerEmail
    ) {
      return jsonError(
        "PAYER_EMAIL_REQUIRED",
        409
      );
    }

    const formattedAmount =
      amount.toFixed(
        2
      );

    // ==========================================
    // CRIAR COBRANÇA MERCADO PAGO
    // ==========================================

    const mercadoPagoBody = {
      type:
        "online",

      external_reference:
        order.id,

      total_amount:
        formattedAmount,

      processing_mode:
        "automatic",

      transactions: {
        payments: [
          {
            amount:
              formattedAmount,

            payment_method: {
              id:
                "pix",

              type:
                "bank_transfer",
            },

            expiration_time:
              "PT30M",
          },
        ],
      },

      payer: {
        email:
          payerEmail,

        ...(
          isTestMode
            ? {
                first_name:
                  "APRO",
              }
            : {}
        ),
      },
    };

    // ==========================================
    // IDEMPOTÊNCIA
    //
    // UM PEDIDO NÃO DEVE CRIAR
    // DUAS COBRANÇAS DIFERENTES.
    // ==========================================

    const idempotencyKey =
      `entrega-paudalho-pix-${order.id}`;

    const mercadoPagoResponse =
      await fetch(
        "https://api.mercadopago.com/v1/orders",
        {
          method:
            "POST",

          headers: {
            Accept:
              "application/json",

            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${mercadoPagoAccessToken}`,

            "X-Idempotency-Key":
              idempotencyKey,
          },

          body:
            JSON.stringify(
              mercadoPagoBody
            ),

          cache:
            "no-store",
        }
      );

    let mercadoPagoData:
      MercadoPagoOrderResponse;

    try {
      mercadoPagoData =
        (
          await mercadoPagoResponse.json()
        ) as MercadoPagoOrderResponse;
    } catch {
      return jsonError(
        "MERCADO_PAGO_INVALID_RESPONSE",
        502
      );
    }

    if (
      !mercadoPagoResponse.ok
    ) {
      console.error(
        "Erro Mercado Pago PIX:",
        {
          status:
            mercadoPagoResponse.status,

          response:
            mercadoPagoData,
        }
      );

      return jsonError(
        "MERCADO_PAGO_CREATE_PIX_FAILED",
        502,
        {
          providerStatus:
            mercadoPagoResponse.status,

          providerMessage:
            mercadoPagoData.message ??
            mercadoPagoData.error ??
            null,

          providerErrors:
            mercadoPagoData.errors ??
            null,
        }
      );
    }

    // ==========================================
    // PAGAMENTO RETORNADO
    // ==========================================

    const payment =
      mercadoPagoData
        .transactions
        ?.payments?.[0];

    const paymentMethod =
      payment
        ?.payment_method;

    if (
      !mercadoPagoData.id ||
      !payment
    ) {
      return jsonError(
        "MERCADO_PAGO_PIX_DATA_MISSING",
        502
      );
    }

    // ==========================================
    // SALVAR REFERÊNCIAS DO MERCADO PAGO
    //
    // IMPORTANTE:
    // NÃO MARCA O PEDIDO COMO PAGO.
    //
    // O WEBHOOK CONTINUA SENDO RESPONSÁVEL
    // POR CONFIRMAR O PAGAMENTO.
    // ==========================================

    const {
      error:
        saveReferenceError,
    } =
      await supabase.rpc(
        "save_my_order_mercado_pago_reference",
        {
          p_order_id:
            order.id,

          p_mercado_pago_order_id:
            mercadoPagoData.id,

          p_mercado_pago_payment_id:
            payment.id ??
            null,

          p_mercado_pago_status:
            mercadoPagoData.status ??
            null,

          p_mercado_pago_status_detail:
            mercadoPagoData.status_detail ??
            null,
        }
      );

    if (
      saveReferenceError
    ) {
      console.error(
        "Erro salvando referência Mercado Pago no pedido:",
        saveReferenceError
      );

      return jsonError(
        "MERCADO_PAGO_REFERENCE_SAVE_FAILED",
        500,
        {
          mercadoPagoOrderId:
            mercadoPagoData.id,
        }
      );
    }

    // ==========================================
    // RESPOSTA
    // ==========================================

    return NextResponse.json({
      ok:
        true,

      testMode:
        isTestMode,

      orderId:
        order.id,

      amount:
        formattedAmount,

      mercadoPagoOrderId:
        mercadoPagoData.id,

      mercadoPagoOrderStatus:
        mercadoPagoData.status ??
        null,

      mercadoPagoOrderStatusDetail:
        mercadoPagoData.status_detail ??
        null,

      mercadoPagoPaymentId:
        payment.id ??
        null,

      paymentStatus:
        payment.status ??
        null,

      paymentStatusDetail:
        payment.status_detail ??
        null,

      qrCode:
        paymentMethod
          ?.qr_code ??
        null,

      qrCodeBase64:
        paymentMethod
          ?.qr_code_base64 ??
        null,

      ticketUrl:
        paymentMethod
          ?.ticket_url ??
        null,
    });
  } catch (
    error
  ) {
    console.error(
      "Erro inesperado criando PIX:",
      error
    );

    return jsonError(
      "INTERNAL_SERVER_ERROR",
      500
    );
  }
}