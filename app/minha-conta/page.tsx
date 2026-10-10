"use client";

import Link from "next/link";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

export default function MinhaContaPage() {
  const router = useRouter();

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [
    changingEmail,
    setChangingEmail,
  ] = useState(false);

  const [
    sendingPassword,
    setSendingPassword,
  ] = useState(false);

  const [
    signingOut,
    setSigningOut,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [name, setName] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [newEmail, setNewEmail] =
    useState("");

  const [
    deletionStatus,
    setDeletionStatus,
  ] =
    useState("");

  const [
    deletionRequestedAt,
    setDeletionRequestedAt,
  ] =
    useState("");

  const [
    deletingAccount,
    setDeletingAccount,
  ] =
    useState(false);

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      setError("");

      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      if (!session) {
        sessionStorage.setItem(
          "after-login",
          "/minha-conta"
        );

        router.replace("/login");

        return;
      }

      const currentEmail =
        session.user.email ?? "";

      setEmail(currentEmail);
      setNewEmail(currentEmail);

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(`
          full_name,
          phone
        `)
        .eq(
          "id",
          session.user.id
        )
        .maybeSingle();

      if (profileError) {
        console.error(
          "Erro ao carregar perfil:",
          profileError
        );

        setError(
          "Não foi possível carregar seus dados."
        );
      }

      if (profile) {
        setName(
          profile.full_name ?? ""
        );

        setPhone(
          profile.phone ?? ""
        );
      }

      const {
        data:
          deletionData,

        error:
          deletionError,
      } =
        await supabase.rpc(
          "get_my_account_deletion_request"
        );

      if (
        deletionError
      ) {
        console.error(
          "Erro solicitação de exclusão:",
          deletionError
        );
      } else {
        const deletion =
          Array.isArray(
            deletionData
          )
            ? deletionData[0]
            : deletionData;

        setDeletionStatus(
          deletion?.status ??
            ""
        );

        setDeletionRequestedAt(
          deletion
            ?.requested_at ??
            ""
        );
      }

      setLoading(false);
    }

    loadProfile();
  }, [router]);

  // ==========================================
  // SALVAR NOME E TELEFONE
  // ==========================================

  async function saveProfile(
    event: FormEvent
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (
      name.trim().length < 2
    ) {
      setError(
        "Digite seu nome corretamente."
      );

      return;
    }

    setSaving(true);

    const {
      data,
      error: updateError,
    } = await supabase.rpc(
      "update_my_profile",
      {
        p_full_name:
          name.trim(),

        p_phone:
          phone.trim(),
      }
    );

    if (updateError) {
      console.error(
        "Erro ao atualizar perfil:",
        updateError
      );

      setError(
        "Não foi possível salvar as alterações."
      );

      setSaving(false);

      return;
    }

    if (
      Array.isArray(data) &&
      data.length > 0
    ) {
      setName(
        data[0].full_name ?? ""
      );

      setPhone(
        data[0].phone ?? ""
      );
    }

    setSuccess(
      "Dados pessoais atualizados com sucesso!"
    );

    setSaving(false);

    router.refresh();
  }

  // ==========================================
  // ALTERAR E-MAIL
  // ==========================================

  async function changeEmail() {
    setError("");
    setSuccess("");

    const cleanEmail =
      newEmail
        .trim()
        .toLowerCase();

    if (!cleanEmail) {
      setError(
        "Digite o novo e-mail."
      );

      return;
    }

    if (
      !cleanEmail.includes("@")
    ) {
      setError(
        "Digite um e-mail válido."
      );

      return;
    }

    if (
      cleanEmail ===
      email.toLowerCase()
    ) {
      setError(
        "Este já é o e-mail atual da sua conta."
      );

      return;
    }

    setChangingEmail(true);

    const {
      error: updateError,
    } =
      await supabase.auth.updateUser(
        {
          email: cleanEmail,
        }
      );

    if (updateError) {
      console.error(
        "Erro ao alterar email:",
        updateError
      );

      setError(
        "Não foi possível solicitar a alteração do e-mail."
      );

      setChangingEmail(false);

      return;
    }

    setSuccess(
      "Solicitação enviada. Confira seu e-mail para confirmar a alteração."
    );

    setChangingEmail(false);
  }

  // ==========================================
  // REDEFINIR SENHA
  // ==========================================

  async function sendPasswordReset() {
    setError("");
    setSuccess("");

    if (!email) {
      setError(
        "Não foi possível identificar o e-mail da conta."
      );

      return;
    }

    setSendingPassword(true);

    const {
      error: resetError,
    } =
      await supabase.auth
        .resetPasswordForEmail(
          email,
          {
            redirectTo:
              `${window.location.origin}/redefinir-senha`,
          }
        );

    if (resetError) {
      console.error(
        "Erro redefinição senha:",
        resetError
      );

      setError(
        "Não foi possível enviar o e-mail de redefinição de senha."
      );

      setSendingPassword(false);

      return;
    }

    setSuccess(
      `Enviamos um link de redefinição de senha para ${email}.`
    );

    setSendingPassword(false);
  }

  // ==========================================
  // SOLICITAR EXCLUSÃO DA CONTA
  // ==========================================

  async function requestAccountDeletion() {
    if (
      deletingAccount
    ) {
      return;
    }

    const typed =
      window.prompt(
        "Para confirmar, digite EXCLUIR."
      );

    if (
      typed !==
      "EXCLUIR"
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "Deseja realmente solicitar a exclusão da sua conta? A solicitação será processada com segurança para não apagar dados de loja, entregador ou registros obrigatórios por engano."
      );

    if (!confirmed) {
      return;
    }

    setDeletingAccount(
      true
    );

    setError("");
    setSuccess("");

    const {
      error:
        deletionError,
    } =
      await supabase.rpc(
        "request_my_account_deletion"
      );

    if (
      deletionError
    ) {
      console.error(
        "Erro solicitando exclusão:",
        deletionError
      );

      setError(
        "Não foi possível registrar a solicitação de exclusão."
      );

      setDeletingAccount(
        false
      );

      return;
    }

    setDeletionStatus(
      "pending"
    );

    setDeletionRequestedAt(
      new Date()
        .toISOString()
    );

    setSuccess(
      "Solicitação de exclusão registrada."
    );

    setDeletingAccount(
      false
    );
  }

  async function cancelAccountDeletion() {
    if (
      deletingAccount
    ) {
      return;
    }

    setDeletingAccount(
      true
    );

    setError("");
    setSuccess("");

    const {
      data,
      error:
        cancelError,
    } =
      await supabase.rpc(
        "cancel_my_account_deletion"
      );

    if (
      cancelError ||
      data !== true
    ) {
      console.error(
        "Erro cancelando exclusão:",
        cancelError
      );

      setError(
        "Não foi possível cancelar a solicitação."
      );

      setDeletingAccount(
        false
      );

      return;
    }

    setDeletionStatus(
      "cancelled"
    );

    setSuccess(
      "Solicitação de exclusão cancelada."
    );

    setDeletingAccount(
      false
    );
  }

  // ==========================================
  // SAIR
  // ==========================================

  async function logout() {
    if (signingOut) {
      return;
    }

    setSigningOut(true);
    setError("");
    setSuccess("");

    const {
      error: signOutError,
    } =
      await supabase.auth.signOut();

    if (signOutError) {
      console.error(
        "Erro ao sair:",
        signOutError
      );

      setError(
        "Não foi possível sair da conta."
      );

      setSigningOut(false);

      return;
    }

    router.replace("/");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7]">
        <div className="text-center">
          <div className="text-5xl">
            👤
          </div>

          <p className="mt-4 font-bold">
            Carregando sua conta...
          </p>
        </div>
      </main>
    );
  }

  const displayName =
    name.trim() ||
    "Cliente";

  return (
    <main className="min-h-screen bg-[#f7f7f7] text-zinc-900">
      {/* ==================================
          CABEÇALHO
      ================================== */}

      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Link
            href="/"
            className="font-bold text-red-600 transition hover:text-red-700"
          >
            ← Voltar
          </Link>

          <p className="font-black text-red-600">
            Entrega Paudalho
          </p>

          <button
            type="button"
            disabled={signingOut}
            onClick={logout}
            className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-black text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
          >
            {signingOut
              ? "Saindo..."
              : "Sair"}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* ==================================
            APRESENTAÇÃO
        ================================== */}

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
          <div className="bg-gradient-to-r from-red-600 to-red-500 px-6 py-7 text-white md:px-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-white/20 text-4xl ring-4 ring-white/20">
                👤
              </div>

              <div className="min-w-0">
                <p className="text-sm font-bold text-red-100">
                  Minha conta
                </p>

                <h1 className="mt-1 truncate text-3xl font-black md:text-4xl">
                  Olá, {displayName}
                </h1>

                <p className="mt-2 break-all text-sm text-red-50">
                  {email}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-px bg-zinc-100 sm:grid-cols-2">
            <div className="bg-white px-6 py-5">
              <p className="text-xs font-black uppercase tracking-wide text-zinc-400">
                Telefone / WhatsApp
              </p>

              <p className="mt-2 font-bold">
                {phone.trim() ||
                  "Não informado"}
              </p>
            </div>

            <div className="bg-white px-6 py-5">
              <p className="text-xs font-black uppercase tracking-wide text-zinc-400">
                E-mail da conta
              </p>

              <p className="mt-2 break-all font-bold">
                {email ||
                  "Não informado"}
              </p>
            </div>
          </div>
        </section>

        {/* ==================================
            MENSAGENS
        ================================== */}

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-700">
            ✅ {success}
          </div>
        )}

        {/* ==================================
            ACESSOS RÁPIDOS
        ================================== */}

        <section className="mt-8">
          <div>
            <h2 className="text-2xl font-black">
              Acessos rápidos
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Acesse as principais áreas da sua conta.
            </p>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/meus-pedidos"
              className="group rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-2xl">
                🛍️
              </div>

              <h3 className="mt-4 font-black">
                Meus pedidos
              </h3>

              <p className="mt-1 text-sm leading-5 text-zinc-500">
                Acompanhe pedidos em andamento e consulte seu histórico.
              </p>

              <p className="mt-4 text-sm font-black text-red-600">
                Ver pedidos →
              </p>
            </Link>

            <Link
              href="/meus-enderecos"
              className="group rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-2xl">
                📍
              </div>

              <h3 className="mt-4 font-black">
                Meus endereços
              </h3>

              <p className="mt-1 text-sm leading-5 text-zinc-500">
                Cadastre, edite e escolha seus endereços de entrega.
              </p>

              <p className="mt-4 text-sm font-black text-red-600">
                Gerenciar →
              </p>
            </Link>

            <Link
              href="/favoritos"
              className="group rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-2xl">
                ❤️
              </div>

              <h3 className="mt-4 font-black">
                Favoritos
              </h3>

              <p className="mt-1 text-sm leading-5 text-zinc-500">
                Veja os restaurantes que você salvou como favoritos.
              </p>

              <p className="mt-4 text-sm font-black text-red-600">
                Ver favoritos →
              </p>
            </Link>

            <Link
              href="/notificacoes"
              className="group rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-2xl">
                🔔
              </div>

              <h3 className="mt-4 font-black">
                Notificações
              </h3>

              <p className="mt-1 text-sm leading-5 text-zinc-500">
                Veja avisos de pagamento e andamento dos seus pedidos.
              </p>

              <p className="mt-4 text-sm font-black text-red-600">
                Ver avisos →
              </p>
            </Link>

            <Link
              href="/ajuda"
              className="group rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-2xl">
                💬
              </div>

              <h3 className="mt-4 font-black">
                Ajuda e suporte
              </h3>

              <p className="mt-1 text-sm leading-5 text-zinc-500">
                Tire dúvidas e fale com o suporte do Entrega Paudalho.
              </p>

              <p className="mt-4 text-sm font-black text-red-600">
                Abrir suporte →
              </p>
            </Link>

            <a
              href="#dados-pessoais"
              className="group rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-2xl">
                👤
              </div>

              <h3 className="mt-4 font-black">
                Dados pessoais
              </h3>

              <p className="mt-1 text-sm leading-5 text-zinc-500">
                Altere seu nome e telefone usados na plataforma.
              </p>

              <p className="mt-4 text-sm font-black text-red-600">
                Alterar dados ↓
              </p>
            </a>

            <a
              href="#seguranca"
              className="group rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-2xl">
                🔐
              </div>

              <h3 className="mt-4 font-black">
                Segurança
              </h3>

              <p className="mt-1 text-sm leading-5 text-zinc-500">
                Altere seu e-mail ou redefina sua senha.
              </p>

              <p className="mt-4 text-sm font-black text-red-600">
                Ver segurança ↓
              </p>
            </a>
          </div>
        </section>

        {/* ==================================
            CONTEÚDO DA CONTA
        ================================== */}

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_1fr]">
          {/* ==================================
              DADOS PESSOAIS
          ================================== */}

          <form
            id="dados-pessoais"
            onSubmit={saveProfile}
            className="scroll-mt-28 rounded-3xl bg-white p-6 shadow-sm"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-xl">
                👤
              </div>

              <div>
                <h2 className="text-xl font-black">
                  Dados pessoais
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Informações usadas nos seus pedidos.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-bold">
                  Nome
                </label>

                <input
                  value={name}
                  onChange={(event) =>
                    setName(
                      event.target.value
                    )
                  }
                  placeholder="Seu nome"
                  className="w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold">
                  Telefone / WhatsApp
                </label>

                <input
                  type="tel"
                  value={phone}
                  onChange={(event) =>
                    setPhone(
                      event.target.value
                    )
                  }
                  placeholder="(81) 99999-9999"
                  className="w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-6 w-full rounded-xl bg-red-600 px-5 py-4 font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              {saving
                ? "Salvando..."
                : "Salvar dados pessoais"}
            </button>
          </form>

          {/* ==================================
              SEGURANÇA
          ================================== */}

          <section
            id="seguranca"
            className="scroll-mt-28 space-y-6"
          >
            {/* E-MAIL */}

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-xl">
                  ✉️
                </div>

                <div>
                  <h2 className="text-xl font-black">
                    E-mail
                  </h2>

                  <p className="mt-1 text-sm text-zinc-500">
                    Seu e-mail também é usado para entrar na sua conta.
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-sm font-bold">
                  E-mail atual
                </label>

                <div className="break-all rounded-xl bg-zinc-100 px-4 py-3 text-zinc-600">
                  {email}
                </div>
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-sm font-bold">
                  Novo e-mail
                </label>

                <input
                  type="email"
                  value={newEmail}
                  onChange={(event) =>
                    setNewEmail(
                      event.target.value
                    )
                  }
                  placeholder="novoemail@gmail.com"
                  className="w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />
              </div>

              <button
                type="button"
                disabled={changingEmail}
                onClick={changeEmail}
                className="mt-5 w-full rounded-xl border-2 border-red-600 px-5 py-4 font-black text-red-600 transition hover:bg-red-50 disabled:border-zinc-300 disabled:text-zinc-300"
              >
                {changingEmail
                  ? "Enviando..."
                  : "Alterar e-mail"}
              </button>

              <div className="mt-4 rounded-xl bg-yellow-50 p-4 text-sm leading-5 text-yellow-800">
                🔒 Para sua segurança, a alteração só deve ser concluída depois da confirmação enviada por e-mail.
              </div>
            </div>

            {/* SENHA */}

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-xl">
                  🔐
                </div>

                <div>
                  <h2 className="text-xl font-black">
                    Senha
                  </h2>

                  <p className="mt-1 text-sm text-zinc-500">
                    Esqueceu sua senha ou deseja criar uma nova?
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl bg-zinc-50 p-5">
                <p className="font-bold">
                  Redefinir senha
                </p>

                <p className="mt-1 text-sm text-zinc-500">
                  Enviaremos um link para:
                </p>

                <p className="mt-2 break-all font-semibold">
                  {email}
                </p>
              </div>

              <button
                type="button"
                disabled={sendingPassword}
                onClick={sendPasswordReset}
                className="mt-5 w-full rounded-xl bg-zinc-900 px-5 py-4 font-black text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                {sendingPassword
                  ? "Enviando e-mail..."
                  : "📩 Enviar link para redefinir senha"}
              </button>
            </div>
          </section>
        </div>

        {/* ==================================
            ACESSO À CONTA
        ================================== */}

        <section className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-black">
                🚪 Acesso à conta
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                Ao sair, você precisará entrar novamente para acessar pedidos e dados da conta.
              </p>
            </div>

            <button
              type="button"
              disabled={signingOut}
              onClick={logout}
              className="shrink-0 rounded-xl border-2 border-red-600 px-6 py-3 font-black text-red-600 transition hover:bg-red-50 disabled:border-zinc-300 disabled:text-zinc-300"
            >
              {signingOut
                ? "Saindo..."
                : "Sair da conta"}
            </button>
          </div>
        </section>

        {/* ==================================
            EXCLUSÃO DA CONTA
        ================================== */}

        <section className="mt-6 rounded-3xl border border-red-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-wide text-red-600">
                ZONA DE PERIGO
              </p>

              <h2 className="mt-1 text-xl font-black">
                🗑️ Excluir minha conta
              </h2>

              {deletionStatus ===
              "pending" ? (
                <div className="mt-3 rounded-2xl bg-yellow-50 p-4 text-sm leading-6 text-yellow-800">
                  <p className="font-black">
                    ⏳ Solicitação de exclusão pendente
                  </p>

                  {deletionRequestedAt && (
                    <p className="mt-1">
                      Solicitada em{" "}
                      {new Date(
                        deletionRequestedAt
                      ).toLocaleString(
                        "pt-BR"
                      )}
                    </p>
                  )}

                  <p className="mt-2">
                    A remoção é processada com segurança para preservar registros obrigatórios e evitar apagar dados de restaurante ou entregador vinculados à mesma conta por engano.
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  Você pode solicitar a exclusão da sua conta. Por segurança, a remoção não acontece diretamente no navegador e passa pelo fluxo de exclusão da plataforma.
                </p>
              )}
            </div>

            {deletionStatus ===
            "pending" ? (
              <button
                type="button"
                disabled={
                  deletingAccount
                }
                onClick={
                  cancelAccountDeletion
                }
                className="shrink-0 rounded-xl border-2 border-zinc-300 px-5 py-3 font-black text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
              >
                {deletingAccount
                  ? "Cancelando..."
                  : "Cancelar solicitação"}
              </button>
            ) : (
              <button
                type="button"
                disabled={
                  deletingAccount
                }
                onClick={
                  requestAccountDeletion
                }
                className="shrink-0 rounded-xl border-2 border-red-600 px-5 py-3 font-black text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                {deletingAccount
                  ? "Enviando..."
                  : "Solicitar exclusão"}
              </button>
            )}
          </div>
        </section>
      </div>

      {/* ==================================
          RODAPÉ
      ================================== */}

      <footer className="mt-10 border-t border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 text-center">
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
