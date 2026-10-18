"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const PROFILE_PHOTO_BUCKET = "profile-photos";
const SIGNED_URL_SECONDS = 60 * 60;

export default function MinhaContaPage() {
  const router = useRouter();
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [changingEmail, setChangingEmail] = useState(false);
  const [sendingPassword, setSendingPassword] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [userId, setUserId] = useState("");
  const [accountCode, setAccountCode] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [avatarPath, setAvatarPath] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [deletionStatus, setDeletionStatus] = useState("");
  const [deletionRequestedAt, setDeletionRequestedAt] = useState("");

  function clearNotices() {
    setError("");
    setSuccess("");
  }

  async function createAvatarUrl(path: string) {
    if (!path) {
      setAvatarUrl("");
      return;
    }

    const { data, error: urlError } = await supabase.storage
      .from(PROFILE_PHOTO_BUCKET)
      .createSignedUrl(path, SIGNED_URL_SECONDS);

    if (urlError) {
      console.error("Erro ao abrir foto de perfil:", urlError);
      setAvatarUrl("");
      return;
    }

    setAvatarUrl(data.signedUrl);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setLoading(true);
      setError("");

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (cancelled) return;

      if (sessionError || !session) {
        sessionStorage.setItem("after-login", "/minha-conta");
        router.replace("/login");
        return;
      }

      const currentUser = session.user;
      const currentEmail = currentUser.email ?? "";
      const metadataAvatarPath = String(currentUser.user_metadata?.avatar_path ?? "");

      setUserId(currentUser.id);
      setEmail(currentEmail);
      setNewEmail(currentEmail);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, phone, avatar_path, account_code")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (cancelled) return;

      if (profileError) {
        console.error("Erro ao carregar perfil:", profileError);
        setError("Não foi possível carregar todos os seus dados.");
      }

      if (profile) {
        setName(profile.full_name ?? "");
        setPhone(profile.phone ?? "");
        setAccountCode(profile.account_code ?? "");
      } else {
        setName(String(currentUser.user_metadata?.full_name ?? ""));
        setPhone(String(currentUser.user_metadata?.phone ?? ""));
      }

      // A foto pode estar salva no perfil (para o chat) ou nos metadados
      // da autenticação (versões anteriores). Verifica os dois locais.
      const savedAvatarPath = String(
        profile?.avatar_path ?? metadataAvatarPath ?? ""
      );
      setAvatarPath(savedAvatarPath);

      if (savedAvatarPath && savedAvatarPath !== metadataAvatarPath) {
        const { error: metadataSyncError } = await supabase.auth.updateUser({
          data: { avatar_path: savedAvatarPath },
        });
        if (metadataSyncError) {
          console.error("Não foi possível sincronizar a foto com a conta:", metadataSyncError);
        }
      }

      // Se o caminho estava apenas nos metadados antigos, sincroniza com profiles.
      if (metadataAvatarPath && !profile?.avatar_path) {
        const { error: avatarSyncError } = await supabase.rpc(
          "update_my_profile_avatar_path",
          { p_avatar_path: metadataAvatarPath }
        );
        if (avatarSyncError) {
          console.error("Não foi possível sincronizar a foto com o perfil:", avatarSyncError);
        }
      }

      if (savedAvatarPath) {
        const { data: signedData, error: signedError } = await supabase.storage
          .from(PROFILE_PHOTO_BUCKET)
          .createSignedUrl(savedAvatarPath, SIGNED_URL_SECONDS);

        if (!cancelled) {
          if (signedError) {
            console.error("Erro ao abrir foto de perfil:", signedError);
            setAvatarUrl("");
            setError("A referência da foto existe, mas não foi possível abrir o arquivo. Talvez seja necessário enviar a foto novamente.");
          } else {
            setAvatarUrl(signedData.signedUrl);
          }
        }
      } else {
        setAvatarUrl("");
      }

      const { data: deletionData, error: deletionError } = await supabase.rpc(
        "get_my_account_deletion_request"
      );

      if (cancelled) return;

      if (deletionError) {
        console.error("Erro ao consultar solicitação de exclusão:", deletionError);
      } else {
        const deletion = Array.isArray(deletionData) ? deletionData[0] : deletionData;
        setDeletionStatus(deletion?.status ?? "");
        setDeletionRequestedAt(deletion?.requested_at ?? "");
      }

      setLoading(false);
    }

    void loadProfile();
    return () => { cancelled = true; };
  }, [router]);

  async function handlePhotoSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    clearNotices();

    // Aceita imagens reconhecidas pelo navegador e formatos comuns mesmo
    // quando o navegador não informa o MIME type no arquivo selecionado.
    const originalExtension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const supportedPhotoExtensions = new Set([
      "jpg", "jpeg", "png", "webp", "gif", "bmp", "avif",
      "heic", "heif", "tif", "tiff", "jfif", "jxl",
    ]);
    const isImage = file.type.toLowerCase().startsWith("image/");

    if (!isImage && !supportedPhotoExtensions.has(originalExtension)) {
      setError("Selecione um arquivo de imagem para a foto de perfil.");
      return;
    }

    if (!userId) {
      setError("Não foi possível identificar sua conta. Entre novamente.");
      return;
    }

    setUploadingPhoto(true);

    const mimeExtension: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "image/bmp": "bmp",
      "image/avif": "avif",
      "image/heic": "heic",
      "image/heif": "heif",
      "image/tiff": "tiff",
      "image/jxl": "jxl",
    };
    const safeOriginalExtension = originalExtension.replace(/[^a-z0-9]/g, "");
    const extension = safeOriginalExtension || mimeExtension[file.type.toLowerCase()] || "img";
    const mimeByExtension: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      jfif: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      gif: "image/gif",
      bmp: "image/bmp",
      avif: "image/avif",
      heic: "image/heic",
      heif: "image/heif",
      tif: "image/tiff",
      tiff: "image/tiff",
      jxl: "image/jxl",
    };
    const contentType = file.type || mimeByExtension[extension] || "application/octet-stream";
    const newPath = `${userId}/${Date.now()}.${extension}`;
    const oldPath = avatarPath;

    const { error: uploadError } = await supabase.storage
      .from(PROFILE_PHOTO_BUCKET)
      .upload(newPath, file, {
        cacheControl: "3600",
        contentType,
        upsert: false,
      });

    if (uploadError) {
      console.error("Erro ao enviar foto de perfil:", uploadError);
      setError(
        uploadError.message.toLowerCase().includes("bucket")
          ? "O armazenamento de fotos ainda não está configurado no Supabase."
          : "Não foi possível enviar a foto. Verifique as permissões do armazenamento e tente novamente."
      );
      setUploadingPhoto(false);
      return;
    }

    // Salva o caminho também no perfil público para que a outra ponta do chat
    // possa assinar a URL da foto sem acessar os metadados privados do usuário.
    const { data: avatarSaved, error: avatarSaveError } = await supabase.rpc(
      "update_my_profile_avatar_path",
      { p_avatar_path: newPath }
    );

    if (avatarSaveError || avatarSaved !== true) {
      console.error("Erro ao salvar foto no perfil:", avatarSaveError);
      await supabase.storage.from(PROFILE_PHOTO_BUCKET).remove([newPath]);
      setError("A foto foi enviada, mas não foi possível vinculá-la ao perfil. Verifique as permissões no Supabase.");
      setUploadingPhoto(false);
      return;
    }

    const { error: metadataError } = await supabase.auth.updateUser({
      data: { avatar_path: newPath },
    });

    if (metadataError) {
      console.error("Erro ao salvar foto na conta:", metadataError);
      await supabase.rpc("update_my_profile_avatar_path", { p_avatar_path: oldPath || null });
      await supabase.storage.from(PROFILE_PHOTO_BUCKET).remove([newPath]);
      setError("A foto foi enviada, mas não foi possível salvá-la na conta.");
      setUploadingPhoto(false);
      return;
    }

    setAvatarPath(newPath);
    await createAvatarUrl(newPath);

    if (oldPath && oldPath !== newPath) {
      const { error: removeError } = await supabase.storage
        .from(PROFILE_PHOTO_BUCKET)
        .remove([oldPath]);
      if (removeError) {
        console.warn("A foto anterior não pôde ser removida:", removeError);
      }
    }

    setSuccess("Foto de perfil atualizada com sucesso.");
    setUploadingPhoto(false);
  }

  async function removePhoto() {
    if (!avatarPath || uploadingPhoto) return;
    clearNotices();
    setUploadingPhoto(true);

    const { data: avatarRemoved, error: avatarRemoveError } = await supabase.rpc(
      "update_my_profile_avatar_path",
      { p_avatar_path: null }
    );

    if (avatarRemoveError || avatarRemoved !== true) {
      console.error("Erro ao desvincular foto do perfil:", avatarRemoveError);
      setError("Não foi possível atualizar a foto no perfil.");
      setUploadingPhoto(false);
      return;
    }

    const { error: metadataError } = await supabase.auth.updateUser({
      data: { avatar_path: null },
    });

    if (metadataError) {
      console.error("Erro ao remover foto da conta:", metadataError);
      setError("Não foi possível remover a foto de perfil.");
      setUploadingPhoto(false);
      return;
    }

    const { error: removeError } = await supabase.storage
      .from(PROFILE_PHOTO_BUCKET)
      .remove([avatarPath]);

    if (removeError) {
      console.warn("Não foi possível remover o arquivo antigo:", removeError);
    }

    setAvatarPath("");
    setAvatarUrl("");
    setSuccess("Foto de perfil removida.");
    setUploadingPhoto(false);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearNotices();

    if (name.trim().length < 2) {
      setError("Digite seu nome corretamente.");
      return;
    }

    setSaving(true);
    const { data, error: updateError } = await supabase.rpc("update_my_profile", {
      p_full_name: name.trim(),
      p_phone: phone.trim(),
    });

    if (updateError) {
      console.error("Erro ao atualizar perfil:", updateError);
      setError("Não foi possível salvar as alterações.");
      setSaving(false);
      return;
    }

    if (Array.isArray(data) && data.length > 0) {
      setName(data[0].full_name ?? "");
      setPhone(data[0].phone ?? "");
    }

    setSuccess("Dados pessoais atualizados com sucesso.");
    setSaving(false);
    router.refresh();
  }

  async function changeEmail() {
    clearNotices();
    const cleanEmail = newEmail.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Digite um e-mail válido.");
      return;
    }
    if (cleanEmail === email.toLowerCase()) {
      setError("Este já é o e-mail atual da sua conta.");
      return;
    }

    setChangingEmail(true);
    const { error: updateError } = await supabase.auth.updateUser({ email: cleanEmail });

    if (updateError) {
      console.error("Erro ao alterar e-mail:", updateError);
      setError("Não foi possível solicitar a alteração do e-mail.");
      setChangingEmail(false);
      return;
    }

    setSuccess("Solicitação enviada. Confira seu e-mail para confirmar a alteração.");
    setChangingEmail(false);
  }

  async function sendPasswordReset() {
    clearNotices();
    if (!email) {
      setError("Não foi possível identificar o e-mail da conta.");
      return;
    }

    setSendingPassword(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });

    if (resetError) {
      console.error("Erro ao redefinir senha:", resetError);
      setError("Não foi possível enviar o e-mail de redefinição de senha.");
      setSendingPassword(false);
      return;
    }

    setSuccess(`Enviamos um link de redefinição de senha para ${email}.`);
    setSendingPassword(false);
  }

  async function requestAccountDeletion() {
    if (deletingAccount) return;

    const typed = window.prompt("Para confirmar, digite EXCLUIR.");
    if (typed !== "EXCLUIR") return;

    const confirmed = window.confirm(
      "Deseja realmente solicitar a exclusão da sua conta? A solicitação será processada com segurança para preservar registros obrigatórios e dados vinculados."
    );
    if (!confirmed) return;

    setDeletingAccount(true);
    clearNotices();
    const { error: deletionError } = await supabase.rpc("request_my_account_deletion");

    if (deletionError) {
      console.error("Erro ao solicitar exclusão:", deletionError);
      setError("Não foi possível registrar a solicitação de exclusão.");
      setDeletingAccount(false);
      return;
    }

    setDeletionStatus("pending");
    setDeletionRequestedAt(new Date().toISOString());
    setSuccess("Solicitação de exclusão registrada.");
    setDeletingAccount(false);
  }

  async function cancelAccountDeletion() {
    if (deletingAccount) return;
    setDeletingAccount(true);
    clearNotices();

    const { data, error: cancelError } = await supabase.rpc("cancel_my_account_deletion");
    if (cancelError || data !== true) {
      console.error("Erro ao cancelar exclusão:", cancelError);
      setError("Não foi possível cancelar a solicitação.");
      setDeletingAccount(false);
      return;
    }

    setDeletionStatus("cancelled");
    setSuccess("Solicitação de exclusão cancelada.");
    setDeletingAccount(false);
  }

  async function copyAccountCode() {
    clearNotices();
    if (!accountCode) {
      setError("O ID da sua conta ainda não está disponível. Atualize a página e tente novamente.");
      return;
    }

    try {
      await navigator.clipboard.writeText(accountCode);
      setSuccess("ID da conta copiado.");
    } catch (copyError) {
      console.error("Erro ao copiar ID da conta:", copyError);
      setError("Não foi possível copiar automaticamente. Selecione o ID e copie manualmente.");
    }
  }

  async function logout() {
    if (signingOut) return;
    setSigningOut(true);
    clearNotices();

    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      console.error("Erro ao sair:", signOutError);
      setError("Não foi possível sair da conta.");
      setSigningOut(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="text-center">
          <div className="text-4xl">👤</div>
          <p className="mt-3 font-bold text-zinc-700">Carregando sua conta...</p>
        </div>
      </main>
    );
  }

  const displayName = name.trim() || "Cliente";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
          <Link href="/" className="text-sm font-black text-red-600 hover:text-red-700">← Voltar à loja</Link>
          <p className="font-black text-red-600">Entrega Paudalho</p>
          <button type="button" disabled={signingOut} onClick={logout} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm font-bold hover:bg-zinc-50 disabled:opacity-50">
            {signingOut ? "Saindo..." : "Sair"}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
        <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-red-600 to-orange-500 px-5 py-6 text-white sm:px-7">
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
              <div className="relative shrink-0">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="Foto de perfil" className="h-24 w-24 rounded-full border-4 border-white/70 object-cover shadow-md" />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white/70 bg-white/20 text-4xl font-black shadow-md" aria-label="Sem foto de perfil">
                    {initial}
                  </div>
                )}
                <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-red-600 bg-white text-lg" aria-hidden="true">📷</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white/80">Minha conta</p>
                <h1 className="mt-1 break-words text-2xl font-black sm:text-3xl">Olá, {displayName}</h1>
                <p className="mt-1 break-all text-sm text-white/90">{email}</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
                  <button type="button" disabled={uploadingPhoto} onClick={() => photoInputRef.current?.click()} className="rounded-xl bg-white px-4 py-2.5 text-sm font-black text-red-700 shadow-sm transition hover:bg-red-50 disabled:opacity-60">
                    {uploadingPhoto ? "Enviando foto..." : avatarUrl ? "Trocar foto" : "Adicionar foto"}
                  </button>
                  {avatarUrl && (
                    <button type="button" disabled={uploadingPhoto} onClick={removePhoto} className="rounded-xl border border-white/50 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/20 disabled:opacity-60">
                      Remover foto
                    </button>
                  )}
                </div>
                <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoSelected} className="hidden" aria-label="Escolher foto de perfil" />
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 sm:p-6">
            <div className="rounded-2xl bg-zinc-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-zinc-400">Telefone / WhatsApp</p>
              <p className="mt-2 font-bold">{phone.trim() || "Não informado"}</p>
            </div>
            <div className="rounded-2xl bg-zinc-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-zinc-400">E-mail da conta</p>
              <p className="mt-2 break-all font-bold">{email || "Não informado"}</p>
            </div>
            <div className="rounded-2xl border border-red-100 bg-red-50/70 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-red-600">ID da conta</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="break-all font-black tracking-wide text-zinc-900">{accountCode || "Gerando ID..."}</p>
                <button
                  type="button"
                  onClick={copyAccountCode}
                  disabled={!accountCode}
                  className="shrink-0 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Copiar
                </button>
              </div>
              <p className="mt-2 text-xs text-zinc-500">Código único da sua conta.</p>
            </div>
          </div>
        </section>

        {error && <div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">⚠️ {error}</div>}
        {success && <div role="status" className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">✅ {success}</div>}

        <div className="mt-7 grid items-start gap-5 lg:grid-cols-2">
          <form id="dados-pessoais" onSubmit={saveProfile} className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-xl">👤</span>
              <div><h2 className="text-lg font-black">Dados pessoais</h2><p className="text-sm text-zinc-500">Edite seu nome e telefone.</p></div>
            </div>
            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor="profile-name" className="mb-2 block text-sm font-bold">Nome</label>
                <input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} autoComplete="name" placeholder="Seu nome" className="w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100" />
              </div>
              <div>
                <label htmlFor="profile-phone" className="mb-2 block text-sm font-bold">Telefone / WhatsApp</label>
                <input id="profile-phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" placeholder="(81) 99999-9999" className="w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100" />
              </div>
            </div>
            <button type="submit" disabled={saving} className="mt-5 w-full rounded-xl bg-red-600 px-5 py-3.5 font-black text-white transition hover:bg-red-700 disabled:bg-zinc-300">
              {saving ? "Salvando..." : "Salvar dados"}
            </button>
          </form>

          <section id="seguranca" className="space-y-5">
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-xl">✉️</span>
                <div><h2 className="text-lg font-black">E-mail</h2><p className="text-sm text-zinc-500">Atualize o endereço da sua conta.</p></div>
              </div>
              <p className="mt-4 break-all rounded-xl bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-600">Atual: {email || "Não informado"}</p>
              <label htmlFor="new-email" className="mb-2 mt-4 block text-sm font-bold">Novo e-mail</label>
              <input id="new-email" type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} autoComplete="email" placeholder="novoemail@gmail.com" className="w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100" />
              <button type="button" disabled={changingEmail} onClick={changeEmail} className="mt-4 w-full rounded-xl border-2 border-red-600 px-5 py-3 font-black text-red-600 transition hover:bg-red-50 disabled:opacity-50">
                {changingEmail ? "Enviando..." : "Alterar e-mail"}
              </button>
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-xl">🔐</span>
                <div><h2 className="text-lg font-black">Senha</h2><p className="text-sm text-zinc-500">Receba um link para criar uma nova senha.</p></div>
              </div>
              <button type="button" disabled={sendingPassword} onClick={sendPasswordReset} className="mt-5 w-full rounded-xl bg-zinc-900 px-5 py-3.5 font-black text-white transition hover:bg-zinc-800 disabled:bg-zinc-300">
                {sendingPassword ? "Enviando e-mail..." : "Enviar link para redefinir senha"}
              </button>
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-3xl border border-red-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-wide text-red-600">Zona de segurança</p>
              <h2 className="mt-1 text-lg font-black">Solicitação de exclusão da conta</h2>
              {deletionStatus === "pending" ? (
                <div className="mt-2 rounded-xl bg-yellow-50 p-3 text-sm leading-5 text-yellow-800">
                  <p className="font-bold">Solicitação pendente</p>
                  {deletionRequestedAt && <p className="mt-1">Solicitada em {new Date(deletionRequestedAt).toLocaleString("pt-BR")}</p>}
                  <p className="mt-1">A solicitação é processada com segurança para preservar registros obrigatórios e dados vinculados.</p>
                </div>
              ) : (
                <p className="mt-1 text-sm leading-6 text-zinc-500">A exclusão é solicitada e processada pela plataforma para proteger seus dados.</p>
              )}
            </div>
            {deletionStatus === "pending" ? (
              <button type="button" disabled={deletingAccount} onClick={cancelAccountDeletion} className="shrink-0 rounded-xl border-2 border-zinc-300 px-5 py-3 font-black text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">
                {deletingAccount ? "Cancelando..." : "Cancelar solicitação"}
              </button>
            ) : (
              <button type="button" disabled={deletingAccount} onClick={requestAccountDeletion} className="shrink-0 rounded-xl border-2 border-red-600 px-5 py-3 font-black text-red-600 hover:bg-red-50 disabled:opacity-50">
                {deletingAccount ? "Enviando..." : "Solicitar exclusão"}
              </button>
            )}
          </div>
        </section>

        <div className="mt-6 flex flex-col items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:flex-row">
          <p className="text-sm text-zinc-500">Entrega Paudalho · Paudalho e região</p>
          <button type="button" disabled={signingOut} onClick={logout} className="rounded-xl px-4 py-2 text-sm font-black text-red-600 hover:bg-red-50 disabled:opacity-50">
            {signingOut ? "Saindo..." : "Sair da conta"}
          </button>
        </div>
      </div>
    </main>
  );
}
