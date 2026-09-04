# Redefinição de senha por e-mail

Senhas ficam guardadas de forma criptografada — nem eu nem você conseguimos ver a senha de alguém. A solução é o próprio usuário criar uma nova senha por um link enviado ao e-mail dele.

## O que será criado

1. **Link "Esqueci minha senha"** na tela de acesso: o profissional digita o e-mail e recebe uma mensagem com um link seguro.
2. **Nova tela para criar a senha**: ao clicar no link do e-mail, ele abre uma página onde digita a nova senha duas vezes e entra direto no painel.
3. **Mensagens claras** de confirmação ("Enviamos o link para seu e-mail") e de erro, em português.

Depois disso, para o eduardoaglio basta ele usar esse link na tela de acesso — ou você pedir o envio por ele.

## Detalhes técnicos

- `src/routes/auth.tsx`: novo modo `reset` chamando `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })`.
- Nova rota pública `src/routes/reset-password.tsx` (`ssr: false`), detecta a sessão de recuperação e chama `supabase.auth.updateUser({ password })`, sem `current_password`.
- Mesmo visual atual (logo Unimed, cabeçalho em gradiente verde, bordas grossas, classes `f-fixed`/`f-var`), `head()` própria com título/descrição e `noindex`.
- Verificar o domínio de e-mail do projeto; se ainda não houver envio configurado, seguir o fluxo de configuração para que o e-mail de recuperação chegue.
