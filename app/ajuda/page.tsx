"use client";

import Link from "next/link";

import {
  useMemo,
  useState,
} from "react";

type FaqItem = {
  id: string;
  question: string;
  answer: string;
  category:
    | "pedidos"
    | "pagamento"
    | "entrega"
    | "conta"
    | "cupons";
};

const faqs: FaqItem[] = [
  {
    id: "acompanhar-pedido",
    category: "pedidos",
    question:
      "Como acompanho meu pedido?",
    answer:
      "Abra Meus pedidos e selecione o pedido que deseja acompanhar. Lá você verá o status atualizado, os itens e os detalhes do pedido.",
  },
  {
    id: "pedido-nao-pago",
    category: "pagamento",
    question:
      "Meu pedido está aguardando pagamento. O que faço?",
    answer:
      "Abra Meus pedidos e entre no pedido pendente. Se o pagamento ainda não foi realizado, conclua o pagamento pela tela indicada. Pedidos não pagos também podem ser excluídos quando essa opção estiver disponível.",
  },
  {
    id: "pix",
    category: "pagamento",
    question:
      "Como funciona o pagamento por PIX?",
    answer:
      "Ao finalizar o pedido com PIX, você será direcionado para a tela de pagamento. O pedido só segue para a loja depois que o pagamento for confirmado.",
  },
  {
    id: "cartao",
    category: "pagamento",
    question:
      "Posso pagar com cartão?",
    answer:
      "Quando a opção Cartão estiver disponível no checkout, você poderá selecioná-la para pagar online. As opções exibidas no checkout são as disponíveis para aquele pedido.",
  },
  {
    id: "entrega-ou-retirada",
    category: "entrega",
    question:
      "Posso escolher entrega ou retirada na loja?",
    answer:
      "Sim, quando o restaurante disponibilizar as duas opções. No checkout você escolhe Entrega ou Retirada na loja antes de finalizar o pedido.",
  },
  {
    id: "endereco",
    category: "entrega",
    question:
      "Como altero meu endereço de entrega?",
    answer:
      "Acesse Meus endereços para cadastrar, editar ou remover endereços. No checkout, escolha o endereço que deseja usar naquele pedido.",
  },
  {
    id: "codigo-retirada",
    category: "entrega",
    question:
      "Para que serve o código de retirada ou entrega?",
    answer:
      "O código ajuda a confirmar que o pedido está sendo entregue ou retirado pela pessoa correta. Não compartilhe o código antes do momento solicitado.",
  },
  {
    id: "alterar-dados",
    category: "conta",
    question:
      "Como altero meu nome ou telefone?",
    answer:
      "Abra Minha conta, vá em Dados pessoais, faça a alteração e toque em Salvar dados pessoais.",
  },
  {
    id: "alterar-email",
    category: "conta",
    question:
      "Como altero meu e-mail?",
    answer:
      "Em Minha conta, vá até E-mail, informe o novo endereço e solicite a alteração. Por segurança, pode ser necessário confirmar a mudança pelo e-mail.",
  },
  {
    id: "senha",
    category: "conta",
    question:
      "Esqueci minha senha. Como redefino?",
    answer:
      "Em Minha conta, na área Senha, você pode solicitar um link de redefinição para o e-mail cadastrado.",
  },
  {
    id: "cupom",
    category: "cupons",
    question:
      "Como uso um cupom?",
    answer:
      "No checkout, digite o código na área Cupom de desconto e toque em Aplicar. Se o cupom estiver válido para aquele pedido, o desconto aparecerá antes da finalização.",
  },
  {
    id: "cupom-nao-funciona",
    category: "cupons",
    question:
      "Por que meu cupom não funciona?",
    answer:
      "O cupom pode estar inativo, vencido, ainda não iniciado, ter pedido mínimo, limite de usos, ser exclusivo para primeira compra ou permitir apenas um uso por cliente.",
  },
];

const categories = [
  {
    id: "todos",
    label: "Todos",
    icon: "❓",
  },
  {
    id: "pedidos",
    label: "Pedidos",
    icon: "🛍️",
  },
  {
    id: "pagamento",
    label: "Pagamento",
    icon: "💳",
  },
  {
    id: "entrega",
    label: "Entrega",
    icon: "🛵",
  },
  {
    id: "conta",
    label: "Conta",
    icon: "👤",
  },
  {
    id: "cupons",
    label: "Cupons",
    icon: "🎟️",
  },
] as const;

type CategoryId =
  (typeof categories)[number]["id"];

export default function AjudaPage() {
  const [
    selectedCategory,
    setSelectedCategory,
  ] =
    useState<CategoryId>(
      "todos"
    );

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    openFaq,
    setOpenFaq,
  ] =
    useState("");

  const filteredFaqs =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      return faqs.filter(
        (item) => {
          const categoryMatches =
            selectedCategory ===
              "todos" ||
            item.category ===
              selectedCategory;

          if (
            !categoryMatches
          ) {
            return false;
          }

          if (!term) {
            return true;
          }

          return (
            item.question
              .toLowerCase()
              .includes(
                term
              ) ||
            item.answer
              .toLowerCase()
              .includes(
                term
              )
          );
        }
      );
    }, [
      selectedCategory,
      search,
    ]);

  return (
    <main className="min-h-screen bg-[#f7f7f7] text-zinc-900">
      {/* CABEÇALHO */}

      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link
            href="/"
            className="font-bold text-red-600"
          >
            ← Voltar
          </Link>

          <p className="font-black text-red-600">
            Entrega Paudalho
          </p>

          <Link
            href="/minha-conta"
            className="text-sm font-bold text-zinc-700"
          >
            Minha conta
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* TOPO */}

        <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-red-600 to-red-500 p-6 text-white shadow-sm md:p-8">
          <div className="max-w-2xl">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 text-3xl">
              💬
            </div>

            <h1 className="mt-5 text-3xl font-black md:text-4xl">
              Ajuda e suporte
            </h1>

            <p className="mt-2 text-sm leading-6 text-red-50 md:text-base">
              Encontre respostas rápidas sobre pedidos, pagamentos, entrega, conta e cupons.
            </p>

            <div className="mt-6 rounded-2xl bg-white p-2">
              <div className="flex items-center gap-3 rounded-xl px-3">
                <span className="text-xl">
                  🔎
                </span>

                <input
                  value={search}
                  onChange={(
                    event
                  ) =>
                    setSearch(
                      event.target
                        .value
                    )
                  }
                  placeholder="Buscar uma dúvida"
                  className="w-full bg-transparent px-1 py-3 text-zinc-900 outline-none placeholder:text-zinc-400"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ATALHOS */}

        <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/meus-pedidos"
            className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-red-200 hover:shadow-md"
          >
            <div className="text-3xl">
              🛍️
            </div>

            <h2 className="mt-3 font-black">
              Meus pedidos
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Acompanhar ou consultar pedidos.
            </p>

            <p className="mt-4 text-sm font-black text-red-600">
              Abrir →
            </p>
          </Link>

          <Link
            href="/meus-enderecos"
            className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-red-200 hover:shadow-md"
          >
            <div className="text-3xl">
              📍
            </div>

            <h2 className="mt-3 font-black">
              Endereços
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Gerenciar endereços de entrega.
            </p>

            <p className="mt-4 text-sm font-black text-red-600">
              Gerenciar →
            </p>
          </Link>

          <Link
            href="/favoritos"
            className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-red-200 hover:shadow-md"
          >
            <div className="text-3xl">
              ❤️
            </div>

            <h2 className="mt-3 font-black">
              Favoritos
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Ver restaurantes salvos.
            </p>

            <p className="mt-4 text-sm font-black text-red-600">
              Ver favoritos →
            </p>
          </Link>

          <Link
            href="/minha-conta"
            className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-red-200 hover:shadow-md"
          >
            <div className="text-3xl">
              👤
            </div>

            <h2 className="mt-3 font-black">
              Minha conta
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Dados, e-mail e segurança.
            </p>

            <p className="mt-4 text-sm font-black text-red-600">
              Abrir →
            </p>
          </Link>
        </section>

        {/* FAQ */}

        <section className="mt-9">
          <div>
            <h2 className="text-2xl font-black">
              Dúvidas frequentes
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Escolha um assunto ou pesquise acima.
            </p>
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
            {categories.map(
              (category) => {
                const selected =
                  selectedCategory ===
                  category.id;

                return (
                  <button
                    key={
                      category.id
                    }
                    type="button"
                    onClick={() =>
                      setSelectedCategory(
                        category.id
                      )
                    }
                    className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-black transition ${
                      selected
                        ? "border-red-600 bg-red-600 text-white"
                        : "border-zinc-200 bg-white text-zinc-600 hover:border-red-200"
                    }`}
                  >
                    {
                      category.icon
                    }{" "}
                    {
                      category.label
                    }
                  </button>
                );
              }
            )}
          </div>

          {filteredFaqs.length ===
          0 ? (
            <div className="mt-5 rounded-3xl bg-white p-8 text-center shadow-sm">
              <div className="text-5xl">
                🔎
              </div>

              <h3 className="mt-4 text-xl font-black">
                Nenhuma resposta encontrada
              </h3>

              <p className="mt-2 text-sm text-zinc-500">
                Tente pesquisar com outras palavras.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {filteredFaqs.map(
                (item) => {
                  const opened =
                    openFaq ===
                    item.id;

                  return (
                    <div
                      key={
                        item.id
                      }
                      className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setOpenFaq(
                            opened
                              ? ""
                              : item.id
                          )
                        }
                        className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left"
                      >
                        <span className="font-black">
                          {
                            item.question
                          }
                        </span>

                        <span className="text-xl font-black text-red-600">
                          {opened
                            ? "−"
                            : "+"}
                        </span>
                      </button>

                      {opened && (
                        <div className="border-t border-zinc-100 px-5 py-5 text-sm leading-6 text-zinc-600">
                          {
                            item.answer
                          }
                        </div>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          )}
        </section>

        {/* SUPORTE HUMANO */}

        <section className="mt-9 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm md:p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-2xl">
                🎧
              </div>

              <h2 className="mt-4 text-xl font-black">
                Ainda precisa de ajuda?
              </h2>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Fale diretamente com o suporte do Entrega Paudalho pelo WhatsApp.
              </p>

              <p className="mt-3 text-sm font-black text-zinc-800">
                📱 +55 (81) 98791-6675
              </p>
            </div>

            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <a
                href="https://wa.me/5581987916675?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20com%20o%20Entrega%20Paudalho."
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-green-600 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-green-700"
              >
                💬 Falar no WhatsApp
              </a>

              <Link
                href="/meus-pedidos"
                className="rounded-xl bg-zinc-900 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-zinc-800"
              >
                Ver meus pedidos
              </Link>
            </div>
          </div>
        </section>
      </div>

      <footer className="mt-10 border-t border-zinc-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-8 text-center">
          <p className="font-black text-red-600">
            Entrega Paudalho
          </p>

          <p className="mt-1 text-sm text-zinc-500">
            Paudalho e região
          </p>
        </div>
      </footer>
    </main>
  );
}
