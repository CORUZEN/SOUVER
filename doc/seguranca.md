# Segurança do Sistema SOUVER

> **Documento simples e direto** sobre como o SOUVER protege as informações da empresa.  
> Escrito para qualquer pessoa entender, sem termos técnicos complicados.

---

## 1. Senhas: guardadas como se fossem segredos de Estado

Quando você cria uma senha no SOUVER, o sistema **nunca** a guarda do jeito que você digitou.  
Ele transforma sua senha em um "embaralhado" matemático (chamado *hash*) usando uma tecnologia chamada **bcrypt**.

**O que isso significa na prática:**
- Se alguém roubar o banco de dados, não consegue ver as senhas de ninguém.
- Nem os administradores do sistema conseguem ver sua senha.
- A senha só funciona quando **você** digita ela certinha no login.

> 💡 **Analogia:** É como se sua senha virasse uma receita de bolo impossível de desfazer. Dá pra verificar se o bolo está certo, mas não dá pra descobrir os ingredientes originais só olhando o bolo pronto.

---

## 2. Autenticação de dois fatores (2FA): dupla proteção no login

Além da senha, o SOUVER permite (e, para alguns cargos, obriga) usar um **segundo código** ao fazer login.

**Como funciona:**
1. Você digita login e senha.
2. O sistema pede um código de 6 dígitos que muda a cada 30 segundos no seu celular (app Google Authenticator, Authy, etc.).
3. Só entra quem tiver **os dois**: senha correta + código do celular.

**Códigos de emergência:**
- Se perder o celular, o sistema gera **8 códigos de backup** únicos para usar em emergências.
- Esses códigos também são guardados de forma segura (com o mesmo "embaralhado" das senhas).

> 💡 **Analogia:** É como um prédio com portaria e elevador com senha. Mesmo que alguém passe pela portaria, não sobe sem a segunda senha.

---

## 3. Bloqueio automático contra "chutar" a senha

O SOUVER conta quantas vezes alguém errou a senha. Se errar **5 vezes em 30 minutos**, a conta é **bloqueada automaticamente** por meia hora.

**Por que isso importa:**
- Impede que programas maliciosos fiquem tentando milhares de senhas até acertar.
- O bloqueio avisa o horário que pode tentar de novo.
- Toda tentativa errada fica registrada no log de auditoria.

---

## 4. Tokens e sessões: o "crachá virtual" que expira

Depois que você faz login, o sistema te entrega um **crachá digital temporário** (chamado *token*). Esse crachá tem validade e some sozinho quando o tempo acaba.

**Medidas de segurança nesses crachás:**
- **HttpOnly:** o crachá não pode ser lido por códigos maliciosos de sites falsos.
- **Secure:** só funciona em conexões criptografadas (HTTPS).
- **SameSite:** só funciona dentro do próprio site, não em abas estranhas.
- **Refresh token:** quando o crachá principal vence, você ganha um novo sem precisar digitar a senha de novo — mas esse segundo crachá também é verificado rigorosamente.
- **Sessão por tempo:** administradores podem definir que determinados cargos só ficam logados por X horas.

> 💡 **Analogia:** É como um crachá de visitante que só funciona no prédio certo, só até às 18h, e não adianta tirar foto dele para falsificar.

---

## 5. Alerta quando alguém entra de um lugar diferente

Se você fizer login de um computador, celular ou rede diferente do habitual, o SOUVER **avisa na hora**:

- **Você recebe** uma notificação dentro do sistema.
- **Os administradores recebem** um alerta dizendo que houve acesso suspeito.
- O sistema guarda o endereço de rede (IP) de onde você entrou para comparar com o próximo login.

> 💡 **Analogia:** É como o banco que manda SMS quando seu cartão é usado em outra cidade.

---

## 6. Comunicação criptografada: ninguém espiona pela janela

Tudo o que trafega entre seu celular/computador e o servidor do SOUVER passa por uma **conexão criptografada** (HTTPS/SSL).

**O que isso protege:**
- Senhas, códigos 2FA, dados de vendas, metas, nomes de clientes… nada fica visível para quem estiver "escutando" a internet.
- O certificado de segurança é gerenciado automaticamente pela Vercel (onde o sistema está hospedado).

> 💡 **Analogia:** É como mandar uma carta em um envelope lacrado, em vez de um cartão postal que qualquer um lê.

---

## 7. Banco de dados: protegido como cofre

O SOUVER usa um banco de dados **PostgreSQL** hospedado na **Neon** (nuvem segura). Veja como ele é protegido:

- **Prisma:** o sistema nunca escreve comandos de banco "no braço". Ele usa uma ferramenta que monta as consultas de forma segura, impedindo o famoso ataque de **SQL Injection** (quando bandidos tentam injetar comandos maliciosos pelo formulário).
- **SSL obrigatório:** a conexão com o banco só funciona se estiver criptografada.
- **Senha forte:** o acesso ao banco usa uma senha longa e secreta, guardada em variáveis de ambiente.
- **Migrations:** toda alteração na estrutura do banco é versionada e controlada, ninguém muda nada "no escuro".

---

## 8. Sankhya: só lemos, nunca escrevemos

A integração com o ERP Sankhya é **exclusivamente de leitura**. O SOUVER consulta dados do Sankhya para mostrar no painel, mas **nunca** altera, deleta ou cria nada lá.

**Por que isso é importante:**
- Se houver um problema no SOUVER, o ERP principal continua intacto.
- Não há risco de o SOUVER apagar ou corromper dados do Sankhya por engano.
- Todas as metas e configurações que o SOUVER salva ficam no **banco local dele**, separado do Sankhya.

---

## 9. Auditoria: tudo que acontece fica registrado

O SOUVER guarda um **diário de bordo digital** de quase tudo o que acontece no sistema:

- Quem fez login e quando.
- Quem errou a senha.
- Quem alterou uma meta, um grupo de vendedores ou uma configuração.
- Quem habilitou ou desabilitou o 2FA.
- Acesso de IP diferente.

**Como funciona:**
- Cada ação registra o usuário, a data, o horário, o endereço de rede e o navegador usado.
- Esses logs ficam no banco e podem ser consultados pelos administradores.
- Mesmo que alguém tente apagar algo, o rastro fica.

---

## 10. Permissões e papéis: cada um no seu quadrado

O sistema usa **perfis de acesso** (roles). Cada usuário tem um papel que define o que pode ou não fazer:

- **Vendedor:** vê só suas próprias metas e dados.
- **Gerente:** vê metas da equipe.
- **Administrador:** configura o sistema.
- Alguns cargos **obrigam** o uso de 2FA.

Além disso, cada sessão pode ter duração diferente conforme o cargo. Administradores podem configurar para que determinados usuários sejam deslogados automaticamente após poucas horas.

---

## 11. Segredos e senhas do sistema: nunca no código

Todas as senhas, chaves secretas e tokens de acesso do próprio sistema ficam em um arquivo chamado **`.env.local`**, que:

- **Nunca** é enviado para o GitHub (está no `.gitignore`).
- **Nunca** aparece no código fonte.
- Só quem tem acesso ao servidor da Vercel consegue ver.

Isso inclui:
- Segredo para assinar os tokens de login (JWT_SECRET).
- Senha do banco de dados.
- Chave de acesso para rotinas automáticas (CRON_SECRET).

---

## 12. Cache controlado: proteção contra sobrecarga

O SOUVER guarda algumas respostas do servidor em memória por poucos minutos (cache). Isso:

- Deixa o sistema mais rápido.
- Protege contra ataques que tentam derrubar o site batendo milhares de vezes na mesma página (ataque de negação de serviço — DDoS).
- O cache tem tempo curto (de 3 a 10 minutos), então os dados não ficam desatualizados por muito tempo.

---

## 13. PWA (aplicativo no celular): seguro também

O SOUVER funciona como um aplicativo no celular (PWA). As mesmas regras de segurança do site valem para o app:

- Login obrigatório com senha e 2FA.
- Tokens que expiram.
- Comunicação criptografada.
- Service Worker (o "motor" do app) só funciona dentro do domínio oficial.

---

## 14. Boas práticas que você pode fazer

A tecnologia protege muito, mas você também é parte da segurança:

| ✅ Faça | ❌ Evite |
|---------|----------|
| Use uma senha longa e diferente das outras. | Não anote a senha em post-its no monitor. |
| Ative o 2FA no seu usuário. | Não compartilhe login e senha com colegas. |
| Deslogue quando sair do computador. | Não acesse o sistema em computadores públicos desconhecidos. |
| Guarde os códigos de backup do 2FA em lugar seguro. | Não ignore alertas de "acesso de novo IP". |
| Avise o TI se receber notificação de acesso suspeito. | Não clique em links estranhos que dizem ser do SOUVER. |

---

## Resumo rápido

| Camada | Proteção |
|--------|----------|
| **Senhas** | Guardadas com "embaralhado" matemático (bcrypt) |
| **Login** | 2FA obrigatório para alguns cargos, opcional para todos |
| **Tentativas erradas** | Bloqueio automático após 5 erros em 30 minutos |
| **Sessão** | Token que expira, cookies seguros, refresh controlado |
| **Monitoramento** | Alerta de IP diferente, logs de auditoria completos |
| **Comunicação** | HTTPS criptografado em todo o tráfego |
| **Banco de dados** | Prisma (protege contra SQL injection), SSL, Neon cloud |
| **Sankhya** | Apenas leitura, nunca altera o ERP |
| **Infraestrutura** | Hospedado na Vercel, variáveis secretas isoladas |
| **Cache** | TTL curto (3–10 min), protege contra sobrecarga |

---

*Documento atualizado em: Abril de 2026*
