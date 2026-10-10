import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";

export const runtime = "nodejs";

type WebhookBody = {
  action?: string;
  api_version?: string;
  application_id?: string | number;
  date_created?: string;
  id?: string | number;
  live_mode?: boolean;
  type?: string;
  user_id?: string | number;
  data?: {
    id?: string;
  };
};

type MercadoPagoPayment = {
  id?: string;
  amount?: string;
  paid_amount?: string;
  status?: string;
  status_detail?: string;
};

type MercadoPagoOrderResponse = {
  id?: string;
  external_reference?: string;
  total_amount?: string;
  total_paid_amount?: string;
  status?: string;
  status_detail?: string;
  transactions?: {
    payments?: MercadoPagoPayment[];
  };
  message?: string;
  error?: string;
};

function json(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(
    body,
    {
      status,
    }
  );
}

function parseSignature(
  value: string
) {
  const parts =
    value.split(",");

  let timestamp = "";
  let signature = "";

  for (
    const part of parts
  ) {
    const [
      rawKey,
      ...rawValue
    ] =
      part
        .trim()
        .split("=");

    const key =
      rawKey?.trim();

    const value =
      rawValue
        .join("=")
        .trim();

    if (
      key === "ts"
    ) {
      timestamp =
        value;
    }

    if (
      key === "v1"
    ) {
      signature =
        value;
    }
  }

  return {
    timestamp,
    signature,
  };
}

function safeHexEqual(
  left: string,
  right: string
) {
  if (
    !/^[a-f0-9]+$/i.test(left) ||
    !/^[a-f0-9]+$/i.test(right)
  ) {
    return false;
  }

  if (
    left.length !==
    right.length
  ) {
    return false;
  }

  const leftBuffer =
    Buffer.from(
      left,
      "hex"
    );

  const rightBuffer =
    Buffer.from(
      right,
      "hex"
    );

  if (
    leftBuffer.length !==
    rightBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    leftBuffer,
    rightBuffer
  );
}

function validateMercadoPagoSignature(
  xSignature: string,
  xRequestId: string,
  dataId: string,
  secret: string
) {
  const {
    timestamp,
    signature,
  } =
    parseSignature(
      xSignature
    );

  if (
    !timestamp ||
    !signature
  ) {
    return false;
  }

  const manifest =
    `id:${dataId};request-id:${xRequestId};ts:${timestamp};`;

  const expectedSignature =
    createHmac(
      "sha256",
      secret
    )
      .update(
        manifest
      )
      .digest(
        "hex"
      );

  return safeHexEqual(
    expectedSignature,
    signature
  );
}

export async function POST(
  request: NextRequest
) {
  try {
    // ==========================================
    // VARIÁVEIS SECRETAS DO SERVIDOR
    // ==========================================

    const mercadoPagoAccessToken =
      process.env.MERCADO_PAGO_ACCESS_TOKEN;

    const mercadoPagoWebhookSecret =
      process.env.MERCADO_PAGO_WEBHOOK_SECRET;

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseServiceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (
      !mercadoPagoAccessToken ||
      !mercadoPagoWebhookSecret ||
      !supabaseUrl ||
      !supabaseServiceRoleKey
    ) {
      console.error(
        "Webhook Mercado Pago sem configuração completa."
      );

      return json(
        {
          ok: false,
          error:
            "SERVER_NOT_CONFIGURED",
        },
        500
      );
    }

    // ==========================================
    // DADOS USADOS NA ASSINATURA
    // ==========================================

    const xSignature =
      request.headers.get(
        "x-signature"
      );

    const xRequestId =
      request.headers.get(
        "x-request-id"
      );

    const queryDataId =
      request.nextUrl
        .searchParams
        .get(
          "data.id"
        );

    const queryType =
      request.nextUrl
        .searchParams
        .get(
          "type"
        );

    if (
      !xSignature ||
      !xRequestId ||
      !queryDataId
    ) {
      console.warn(
        "Webhook Mercado Pago sem dados obrigatórios de assinatura."
      );

      return json(
        {
          ok: false,
          error:
            "INVALID_WEBHOOK_HEADERS",
        },
        401
      );
    }

    // ==========================================
    // VALIDAR ASSINATURA HMAC SHA-256
    // ==========================================

    const validSignature =
      validateMercadoPagoSignature(
        xSignature,
        xRequestId,
        queryDataId,
        mercadoPagoWebhookSecret
      );

    if (
      !validSignature
    ) {
      console.warn(
        "Assinatura inválida no webhook Mercado Pago.",
        {
          requestId:
            xRequestId,
          dataId:
            queryDataId,
        }
      );

      return json(
        {
          ok: false,
          error:
            "INVALID_WEBHOOK_SIGNATURE",
        },
        401
      );
    }

    // ==========================================
    // LER BODY
    // ==========================================

    let body:
      WebhookBody;

    try {
      body =
        (await request.json()) as WebhookBody;
    } catch {
      return json(
        {
          ok: false,
          error:
            "INVALID_JSON",
        },
        400
      );
    }

    // ==========================================
    // ACEITAR SOMENTE EVENTO ORDER
    // ==========================================

    const eventType =
      queryType ??
      body.type ??
      "";

    if (
      eventType !==
      "order"
    ) {
      // Não é o evento que este endpoint processa.
      // Respondemos 200 para não causar retentativas
      // desnecessárias de um tópico não utilizado.
      return json({
        ok: true,
        ignored: true,
        reason:
          "UNSUPPORTED_EVENT_TYPE",
      });
    }

    const bodyDataId =
      String(
        body.data?.id ??
        ""
      ).trim();

    if (
      bodyDataId &&
      bodyDataId !==
        queryDataId
    ) {
      console.warn(
        "data.id do body diferente do query param.",
        {
          queryDataId,
          bodyDataId,
        }
      );

      return json(
        {
          ok: false,
          error:
            "WEBHOOK_DATA_ID_MISMATCH",
        },
        400
      );
    }

    // ==========================================
    // CONSULTAR A ORDER DIRETAMENTE NO
    // MERCADO PAGO.
    //
    // NÃO confiamos no status enviado no webhook.
    // ==========================================

    const mercadoPagoResponse =
      await fetch(
        `https://api.mercadopago.com/v1/orders/${encodeURIComponent(
          queryDataId
        )}`,
        {
          method:
            "GET",

          headers: {
            Accept:
              "application/json",

            Authorization:
              `Bearer ${mercadoPagoAccessToken}`,
          },

          cache:
            "no-store",
        }
      );

    let mercadoPagoOrder:
      MercadoPagoOrderResponse;

    try {
      mercadoPagoOrder =
        (await mercadoPagoResponse.json()) as MercadoPagoOrderResponse;
    } catch {
      console.error(
        "Resposta inválida consultando Order no Mercado Pago."
      );

      return json(
        {
          ok: false,
          error:
            "MERCADO_PAGO_INVALID_RESPONSE",
        },
        502
      );
    }

    if (
      !mercadoPagoResponse.ok
    ) {
      console.error(
        "Erro consultando Order no Mercado Pago:",
        {
          status:
            mercadoPagoResponse.status,

          response:
            mercadoPagoOrder,
        }
      );

      return json(
        {
          ok: false,
          error:
            "MERCADO_PAGO_ORDER_LOOKUP_FAILED",

          providerStatus:
            mercadoPagoResponse.status,

          providerMessage:
            mercadoPagoOrder.message ??
            mercadoPagoOrder.error ??
            null,
        },
        502
      );
    }

    // ==========================================
    // CONFERIR IDENTIDADE DA ORDER
    // ==========================================

    if (
      !mercadoPagoOrder.id ||
      mercadoPagoOrder.id !==
        queryDataId
    ) {
      return json(
        {
          ok: false,
          error:
            "MERCADO_PAGO_ORDER_ID_MISMATCH",
        },
        409
      );
    }

    // external_reference foi criado por nós
    // com o UUID do pedido do Entrega Paudalho.

    const localOrderId =
      String(
        mercadoPagoOrder.external_reference ??
        ""
      ).trim();

    if (
      !localOrderId
    ) {
      return json(
        {
          ok: false,
          error:
            "MERCADO_PAGO_EXTERNAL_REFERENCE_MISSING",
        },
        409
      );
    }

    const totalAmount =
      Number(
        mercadoPagoOrder.total_amount
      );

    if (
      !Number.isFinite(
        totalAmount
      ) ||
      totalAmount <= 0
    ) {
      return json(
        {
          ok: false,
          error:
            "MERCADO_PAGO_TOTAL_INVALID",
        },
        409
      );
    }

    const payment =
      mercadoPagoOrder
        .transactions
        ?.payments
        ?.[0];

    // ==========================================
    // CLIENTE SUPABASE SOMENTE DO SERVIDOR
    // ==========================================

    const supabaseAdmin =
      createClient(
        supabaseUrl,
        supabaseServiceRoleKey,
        {
          auth: {
            persistSession:
              false,

            autoRefreshToken:
              false,
          },
        }
      );

    // ==========================================
    // SINCRONIZAR NO BANCO
    //
    // A RPC:
    // - confere o pedido
    // - confere o valor
    // - confere mercado_pago_order_id
    // - só marca paid em processed + accredited
    // ==========================================

    const {
      data:
        localPaymentStatus,

      error:
        syncError,
    } =
      await supabaseAdmin.rpc(
        "sync_mercado_pago_order_payment",
        {
          p_order_id:
            localOrderId,

          p_mercado_pago_order_id:
            mercadoPagoOrder.id,

          p_mercado_pago_payment_id:
            payment?.id ??
            null,

          p_order_status:
            mercadoPagoOrder.status ??
            null,

          p_order_status_detail:
            mercadoPagoOrder.status_detail ??
            null,

          p_payment_status:
            payment?.status ??
            null,

          p_payment_status_detail:
            payment?.status_detail ??
            null,

          p_total_amount:
            totalAmount,
        }
      );

    if (
      syncError
    ) {
      console.error(
        "Erro sincronizando pagamento Mercado Pago:",
        syncError
      );

      return json(
        {
          ok: false,
          error:
            "PAYMENT_SYNC_FAILED",
        },
        500
      );
    }

    console.log(
      "Webhook Mercado Pago processado:",
      {
        mercadoPagoOrderId:
          mercadoPagoOrder.id,

        localOrderId,

        orderStatus:
          mercadoPagoOrder.status ??
          null,

        orderStatusDetail:
          mercadoPagoOrder.status_detail ??
          null,

        paymentStatus:
          payment?.status ??
          null,

        paymentStatusDetail:
          payment?.status_detail ??
          null,

        localPaymentStatus:
          localPaymentStatus ??
          null,
      }
    );

    // Mercado Pago considera 200/201 como
    // confirmação de recebimento.
    return json({
      ok: true,

      mercadoPagoOrderId:
        mercadoPagoOrder.id,

      orderId:
        localOrderId,

      paymentStatus:
        localPaymentStatus ??
        null,
    });
  } catch (
    error
  ) {
    console.error(
      "Erro inesperado no webhook Mercado Pago:",
      error
    );

    return json(
      {
        ok: false,
        error:
          "INTERNAL_SERVER_ERROR",
      },
      500
    );
  }
}
