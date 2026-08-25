import { useState, useEffect, useRef, useCallback, useMemo } from "react";

/* ─── CONFIG — altere apenas estas duas linhas ────────────────── */
const SUPABASE_URL = "https://qeipimijviakflqkipiv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlaXBpbWlqdmlha2ZscWtpcGl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MTE4MDMsImV4cCI6MjA5NTQ4NzgwM30.p_iJA3X3lm8YHaf8FyD4dsivBFoMUCicF5-5OS1WIC0";

/* Detecta modo demo automaticamente — NÃO altere esta linha */
const DEMO_MODE = SUPABASE_URL.includes("SEU_PROJETO");

/* ─── SUPABASE CLIENT ────────────────────────────────────────────
   Token de sessão atualizado dinamicamente após o login           */
let _sessionToken = SUPABASE_KEY;

function getHeaders(extra = {}) {
  return {
    "Content-Type": "application/json",
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${_sessionToken}`,
    ...extra,
  };
}

const sb = {
  /* Lê dados de uma tabela com filtros opcionais */
  async get(tabela, filtros = "") {
    const sep = filtros ? "&" : "";
    const url = `${SUPABASE_URL}/rest/v1/${tabela}?${filtros}${sep}order=id.asc`;
    try {
      const r = await fetch(url, { headers: getHeaders() });
      if (!r.ok) { console.error(`GET ${tabela}:`, r.status, await r.text()); return []; }
      return r.json();
    } catch (e) { console.error(`GET ${tabela}:`, e); return []; }
  },

  /* Insere um registro e retorna o registro criado */
  async post(tabela, corpo) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}`, {
        method: "POST",
        headers: getHeaders({ "Prefer": "return=representation" }),
        body: JSON.stringify(corpo),
      });
      if (!r.ok) { console.error(`POST ${tabela}:`, r.status, await r.text()); return null; }
      const dados = await r.json();
      return Array.isArray(dados) ? dados[0] : dados;
    } catch (e) { console.error(`POST ${tabela}:`, e); return null; }
  },

  /* Atualiza um registro pelo id */
  async patch(tabela, id, corpo) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?id=eq.${id}`, {
        method: "PATCH",
        headers: getHeaders({ "Prefer": "return=representation" }),
        body: JSON.stringify(corpo),
      });
      if (!r.ok) { console.error(`PATCH ${tabela}:`, r.status, await r.text()); return null; }
      const dados = await r.json();
      return Array.isArray(dados) ? dados[0] : dados;
    } catch (e) { console.error(`PATCH ${tabela}:`, e); return null; }
  },

  /* Remove um registro pelo id */
  async del(tabela, id) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?id=eq.${id}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
      if (!r.ok) console.error(`DELETE ${tabela}:`, r.status);
    } catch (e) { console.error(`DELETE ${tabela}:`, e); }
  },

  /* Login com e-mail e senha — retorna { user, token } ou null */
  async login(email, senha) {
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY },
        body: JSON.stringify({ email, password: senha }),
      });
      const dados = await r.json();
      if (dados.error || !dados.access_token) return { erro: dados.error_description || "Credenciais incorretas." };
      _sessionToken = dados.access_token; // atualiza token para todas as próximas chamadas
      return { token: dados.access_token, userId: dados.user?.id, email: dados.user?.email };
    } catch (e) { return { erro: "Erro de conexão com o servidor." }; }
  },

  /* Cadastro de novo usuário. Se a confirmação de e-mail estiver desativada no projeto,
     o Supabase já retorna uma sessão ativa — nesse caso, atualiza o token para que os
     próximos requests (ex: criar o registro do afiliado) sejam feitos autenticados,
     e não com a anon key (o que faria a RLS rejeitar o insert). */
  async signup(email, senha) {
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY },
        body: JSON.stringify({ email, password: senha }),
      });
      const dados = await r.json();
      if (dados.error) return { erro: dados.msg || dados.error };
      if (dados.access_token) _sessionToken = dados.access_token;
      return { ok: true, userId: dados.user?.id || dados.id };
    } catch (e) { return { erro: "Erro de conexão." }; }
  },

  /* Envia e-mail de recuperação de senha */
  async recover(email) {
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY },
        body: JSON.stringify({ email, redirect_to: window.location.origin + window.location.pathname }),
      });
      if (!r.ok) { const d = await r.json().catch(()=>({})); return { erro: d.msg || d.error_description || "Não foi possível enviar o e-mail." }; }
      return { ok: true };
    } catch (e) { return { erro: "Erro de conexão." }; }
  },

  /* Define nova senha usando o token recebido por e-mail (fluxo de recuperação) */
  async updatePassword(novaSenha, accessToken) {
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${accessToken}` },
        body: JSON.stringify({ password: novaSenha }),
      });
      const dados = await r.json();
      if (!r.ok) return { erro: dados.msg || dados.error_description || "Não foi possível redefinir a senha." };
      return { ok: true };
    } catch (e) { return { erro: "Erro de conexão." }; }
  },

  /* Assinatura paga — cobra no Asaas via Edge Function e só ativa a conta se o pagamento for confirmado */
  async checkout(payload) {
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/asaas-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify(payload),
      });
      const dados = await r.json();
      if (!r.ok || dados.erro) return { erro: dados.erro || "Não foi possível processar sua assinatura." };
      return { ok: true };
    } catch (e) { return { erro: "Erro de conexão com o servidor de pagamentos." }; }
  },

  /* Cadastro de afiliado — cria conta já confirmada via Edge Function (o projeto exige confirmação de e-mail) */
  async cadastrarAfiliado(payload) {
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/afiliado-signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify(payload),
      });
      const dados = await r.json();
      if (!r.ok || dados.erro) return { erro: dados.erro || "Não foi possível concluir o cadastro." };
      return { ok: true, codigo: dados.codigo };
    } catch (e) { return { erro: "Erro de conexão com o servidor." }; }
  },
};

/* ─── TEMAS ──────────────────────────────────────────────────── */
const T = { bg:"#FAF7FF",surface:"#FFFFFF",card:"#FFFFFF",border:"#E5DAF5",gold:"#B8960C",goldLt:"#D4AF2E",goldDk:"#8A7009",muted:"#9B87B8",mutedLt:"#6B5A87",danger:"#D64550",success:"#2E9E6B",text:"#332845" };
const C = { bg:"#FAF7FF",surface:"#FFFFFF",card:"#FFFFFF",border:"#E8E0F5",accent:"#7C5CBF",accentSoft:"#7C5CBF14",gold:"#B8960C",goldSoft:"#B8960C14",text:"#332845",muted:"#8577A0",success:"#2E9E6B",danger:"#D64550",info:"#3B7DD8",purple:"#9B6BD4",warn:"#C9821A" };

/* ─── DEMO DATA ──────────────────────────────────────────────── */
const DEMO_USERS = [
  {id:"demo-1",email:"demo@clinica.com",senha:"demo123",clinica:"Studio Demo",plano:"anual",role:"supervisor",nome:"Michelangelo (Supervisor)",profissionalId:null},
  {id:"demo-2",email:"admin@estetica.com",senha:"admin123",clinica:"Clínica Lumière",plano:"mensal",role:"supervisor",nome:"Admin",profissionalId:null},
  {id:"demo-3",email:"profissional@clinica.com",senha:"prof123",clinica:"Studio Demo",plano:"anual",role:"profissional",nome:"Dra. Camila Rocha",profissionalId:1},
];
const mkDemo = () => ({
  profissionais:[
    {id:1,nome:"Dra. Camila Rocha",especialidade:"Harmonização Facial",tipo:"percentual",percentual:40,cor:"#C9A96E",email:"camila@clinica.com",telefone:"(11)99999-1111",ativo:true,permite_cadastros:true},
    {id:2,nome:"Dra. Fernanda Lima",especialidade:"Estética Corporal",tipo:"fixo",salario:4500,cor:"#6B9FFF",email:"fernanda@clinica.com",telefone:"(11)99999-2222",ativo:true},
    {id:3,nome:"Vitória Mendes",especialidade:"Skincare",tipo:"percentual",percentual:35,cor:"#3ECFB2",email:"vitoria@clinica.com",telefone:"(11)99999-3333",ativo:true},
  ],
  fornecedores:[
    {id:1,razao_social:"Derma Supplies Ltda",nome_fantasia:"DermaSupply",cnpj:"12.345.678/0001-90",email:"contato@dermasupply.com",telefone:"(11)3333-1111",whatsapp:"(11)99999-4444",contato_nome:"Carlos Silva",cidade:"São Paulo",estado:"SP",ativo:true},
    {id:2,razao_social:"BioEstética Distribuidora",nome_fantasia:"BioEstética",cnpj:"98.765.432/0001-10",email:"vendas@bioestetica.com",telefone:"(11)3333-2222",whatsapp:"(11)99999-5555",contato_nome:"Ana Ferreira",cidade:"São Paulo",estado:"SP",ativo:true},
  ],
  produtos:[
    {id:1,fornecedor_id:1,nome:"Toxina Botulínica 100u",categoria:"Injetável",unidade:"frasco",custo_unitario:800,preco_venda:0,markup:0,estoque_atual:5,estoque_minimo:2,estoque_inicial:5,ativo:true},
    {id:2,fornecedor_id:1,nome:"Ácido Hialurônico 1ml",categoria:"Injetável",unidade:"seringa",custo_unitario:250,preco_venda:0,markup:0,estoque_atual:8,estoque_minimo:3,estoque_inicial:8,ativo:true},
    {id:3,fornecedor_id:2,nome:"Sérum Vitamina C 30ml",categoria:"Skincare",unidade:"frasco",custo_unitario:95,preco_venda:0,markup:0,estoque_atual:6,estoque_minimo:3,estoque_inicial:6,ativo:true},
    {id:4,fornecedor_id:2,nome:"Gel Deslizante 500g",categoria:"Corporal",unidade:"bisnaga",custo_unitario:28,preco_venda:0,markup:0,estoque_atual:12,estoque_minimo:4,estoque_inicial:12,ativo:true},
    {id:5,fornecedor_id:1,nome:"Luvas Nitrílica P (cx100)",categoria:"EPI",unidade:"caixa",custo_unitario:35,preco_venda:0,markup:0,estoque_atual:3,estoque_minimo:2,estoque_inicial:3,ativo:true},
  ],
  procedimentos:[
    {id:1,nome:"Botox Facial",categoria:"Facial",duracao_minutos:60,preco_venda:800,markup:200,custo_insumos:120,custo_fixo:85,custo_total:205,margem:74,ativo:true},
    {id:2,nome:"Preenchimento Labial",categoria:"Facial",duracao_minutos:45,preco_venda:1200,markup:300,custo_insumos:200,custo_fixo:64,custo_total:264,margem:78,ativo:true},
    {id:3,nome:"Limpeza de Pele",categoria:"Skincare",duracao_minutos:90,preco_venda:250,markup:150,custo_insumos:30,custo_fixo:128,custo_total:158,margem:37,ativo:true},
    {id:4,nome:"Drenagem Linfática",categoria:"Corporal",duracao_minutos:60,preco_venda:180,markup:120,custo_insumos:10,custo_fixo:85,custo_total:95,margem:47,ativo:true},
    {id:5,nome:"Radiofrequência",categoria:"Corporal",duracao_minutos:75,preco_venda:350,markup:180,custo_insumos:20,custo_fixo:106,custo_total:126,margem:64,ativo:true},
  ],
  procedimento_insumos:[
    {id:1,procedimento_id:1,produto_id:1,quantidade:0.5,custo_unitario:800,custo_total:80},
    {id:2,procedimento_id:1,produto_id:5,quantidade:0.1,custo_unitario:35,custo_total:3.5},
    {id:3,procedimento_id:2,produto_id:2,quantidade:1,custo_unitario:250,custo_total:250},
    {id:4,procedimento_id:3,produto_id:3,quantidade:0.3,custo_unitario:95,custo_total:28.5},
    {id:5,procedimento_id:4,produto_id:4,quantidade:0.5,custo_unitario:28,custo_total:14},
  ],
  formas_pagamento:[
    {id:1,nome:"Dinheiro",tipo:"dinheiro",prazo_dias:0,taxa_percentual:0,ativo:true},
    {id:2,nome:"PIX",tipo:"pix",prazo_dias:0,taxa_percentual:0,ativo:true},
    {id:3,nome:"Cartão Débito",tipo:"debito",prazo_dias:1,taxa_percentual:1.5,ativo:true},
    {id:4,nome:"Cartão Crédito 1x",tipo:"credito",prazo_dias:30,taxa_percentual:2.5,ativo:true},
    {id:5,nome:"Cartão Crédito 2x",tipo:"credito",prazo_dias:60,taxa_percentual:3.5,ativo:true},
    {id:6,nome:"Transferência",tipo:"transferencia",prazo_dias:1,taxa_percentual:0,ativo:true},
  ],
  contas_bancarias:[
    {id:1,nome:"Caixa Físico",tipo:"caixa",banco:"",saldo_inicial:500,ativo:true},
    {id:2,nome:"Conta Corrente Nubank",tipo:"conta_corrente",banco:"Nubank",agencia:"0001",conta:"12345-6",saldo_inicial:8000,ativo:true},
  ],
  pacientes:[
    {id:1,nome:"Ana Paula Silva",cpf:"123.456.789-00",telefone:"(11)98888-1111",whatsapp:"(11)98888-1111",email:"ana@email.com",nascimento:"1990-03-15",sexo:"F",como_conheceu:"Instagram",observacoes:"Alergia a látex",tags:["vip","fidelizada"],total_gasto:2800,total_visitas:4,ultima_visita:"2025-05-22"},
    {id:2,nome:"Beatriz Costa",cpf:"987.654.321-00",telefone:"(11)98888-2222",whatsapp:"(11)98888-2222",email:"beatriz@email.com",nascimento:"1985-07-22",sexo:"F",como_conheceu:"Indicação",observacoes:"",tags:["regular"],total_gasto:750,total_visitas:2,ultima_visita:"2025-05-21"},
    {id:3,nome:"Carla Mendonça",cpf:"456.789.123-00",telefone:"(11)98888-3333",whatsapp:"(11)98888-3333",email:"carla@email.com",nascimento:"1993-11-08",sexo:"F",como_conheceu:"Google",observacoes:"Prefere manhã",tags:["nova"],total_gasto:1200,total_visitas:1,ultima_visita:"2025-05-22"},
  ],
  anamneses:[],
  agendamentos:[
    {id:1,paciente_id:1,paciente:"Ana Paula Silva",procedimento_id:1,servico:"Botox Facial",profissional_id:1,data:today(),hora:"09:00",duracao_minutos:60,status:"confirmado",valor:800},
    {id:2,paciente_id:2,paciente:"Beatriz Costa",procedimento_id:3,servico:"Limpeza de Pele",profissional_id:3,data:today(),hora:"10:30",duracao_minutos:90,status:"aguardando",valor:250},
    {id:3,paciente_id:3,paciente:"Carla Mendonça",procedimento_id:2,servico:"Preenchimento Labial",profissional_id:1,data:today(),hora:"14:00",duracao_minutos:45,status:"confirmado",valor:1200},
  ],
  atendimentos:[
    {id:1,paciente_id:1,paciente:"Ana Paula Silva",procedimento_id:1,servico:"Botox Facial",profissional_id:1,data:"2025-05-20",valor:800,desconto:0,valor_final:800,pago:true,forma_pagamento:"PIX",forma_pagamento_id:2,conta_id:2},
    {id:2,paciente_id:2,paciente:"Beatriz Costa",procedimento_id:3,servico:"Limpeza de Pele",profissional_id:3,data:"2025-05-21",valor:250,desconto:0,valor_final:250,pago:true,forma_pagamento:"Cartão Débito",forma_pagamento_id:3,conta_id:2},
    {id:3,paciente_id:3,paciente:"Carla Mendonça",procedimento_id:2,servico:"Preenchimento Labial",profissional_id:1,data:"2025-05-22",valor:1200,desconto:0,valor_final:1200,pago:true,forma_pagamento:"Dinheiro",forma_pagamento_id:1,conta_id:1},
    {id:4,paciente_id:1,paciente:"Ana Paula Silva",procedimento_id:4,servico:"Drenagem Linfática",profissional_id:2,data:"2025-05-23",valor:180,desconto:0,valor_final:180,pago:false,forma_pagamento:"",forma_pagamento_id:null,conta_id:null},
  ],
  despesas_fixas:[
    {id:1,nome:"Aluguel",valor:6000,categoria:"Imóvel"},
    {id:2,nome:"Energia Elétrica",valor:800,categoria:"Utilidades"},
    {id:3,nome:"Internet",valor:300,categoria:"Utilidades"},
    {id:4,nome:"Contador",valor:600,categoria:"Administrativo"},
    {id:5,nome:"Marketing Digital",valor:1000,categoria:"Marketing"},
  ],
  despesas_variaveis:[
    {id:1,nome:"Materiais Botox",valor:1200,data:"2025-05-10",categoria:"Insumos"},
    {id:2,nome:"Luvas e EPIs",valor:180,data:"2025-05-12",categoria:"Insumos"},
  ],
  contas_dre:[
    {id:1,nome:"Receita de Serviços (Atendimentos)",tipo:"receita",grupo:"receita_bruta",ordem:1,ativo:true},
    {id:2,nome:"Receita de Aluguel de Salas",tipo:"receita",grupo:"receita_bruta",ordem:2,ativo:true},
    {id:3,nome:"Outras Receitas Operacionais",tipo:"receita",grupo:"receita_bruta",ordem:3,ativo:true},
    {id:4,nome:"Impostos sobre Serviços (ISS/Simples)",tipo:"despesa",grupo:"deducoes",ordem:1,ativo:true},
    {id:5,nome:"Descontos e Devoluções",tipo:"despesa",grupo:"deducoes",ordem:2,ativo:true},
    {id:6,nome:"Custo dos Serviços Prestados",tipo:"despesa",grupo:"custos",ordem:1,ativo:true},
    {id:7,nome:"Despesas com Pessoal",tipo:"despesa",grupo:"despesas_operacionais",ordem:1,ativo:true},
    {id:8,nome:"Despesas Administrativas",tipo:"despesa",grupo:"despesas_operacionais",ordem:2,ativo:true},
    {id:9,nome:"Despesas Comerciais/Marketing",tipo:"despesa",grupo:"despesas_operacionais",ordem:3,ativo:true},
    {id:10,nome:"Despesas Gerais",tipo:"despesa",grupo:"despesas_operacionais",ordem:4,ativo:true},
    {id:11,nome:"Receitas Financeiras",tipo:"receita",grupo:"receitas_financeiras",ordem:1,ativo:true},
    {id:12,nome:"Despesas Financeiras e Taxas Bancárias",tipo:"despesa",grupo:"despesas_financeiras",ordem:1,ativo:true},
    {id:13,nome:"IR/CSLL",tipo:"despesa",grupo:"impostos_lucro",ordem:1,ativo:true},
  ],
  categorias_financeiras:[
    {id:1,nome:"Atendimentos",tipo:"receita",ativo:true,conta_dre_id:1},
    {id:2,nome:"Aluguel de Salas",tipo:"receita",ativo:true,conta_dre_id:2},
    {id:3,nome:"Outras Receitas",tipo:"receita",ativo:true,conta_dre_id:3},
    {id:4,nome:"Aluguel/Condomínio",tipo:"despesa",ativo:true,conta_dre_id:8},
    {id:5,nome:"Salários",tipo:"despesa",ativo:true,conta_dre_id:7},
    {id:6,nome:"Marketing",tipo:"despesa",ativo:true,conta_dre_id:9},
    {id:7,nome:"Impostos e Taxas",tipo:"despesa",ativo:true,conta_dre_id:4},
    {id:8,nome:"Insumos e Produtos",tipo:"despesa",ativo:true,conta_dre_id:null},
    {id:9,nome:"Outras Despesas",tipo:"despesa",ativo:true,conta_dre_id:10},
  ],
  contas_receber:[
    {id:1,atendimento_id:4,paciente_id:1,paciente:"Ana Paula Silva",descricao:"Drenagem Linfática",valor:180,categoria_id:1,vencimento:"2025-05-30",data_lancamento:"2025-05-23",data_competencia:"2025-05-23",status:"aberto",forma_pagamento:"PIX",conta_id:null},
  ],
  contas_pagar:[
    {id:1,fornecedor:"DermaSupply",descricao:"Pedido #1204 — insumos",categoria:"Insumos",categoria_id:8,recorrente:false,valor:2800,vencimento:"2025-06-05",data_lancamento:"2025-05-28",data_competencia:"2025-06-05",status:"aberto",conta_id:null},
    {id:2,fornecedor:"",descricao:"Aluguel Junho",categoria:"Imóvel",categoria_id:4,recorrente:true,valor:6000,vencimento:"2025-06-05",data_lancamento:"2025-05-28",data_competencia:"2025-06-05",status:"aberto",conta_id:null},
  ],
  movimentacoes:[
    {id:1,conta_id:1,tipo:"entrada",origem:"atendimento",descricao:"Recebimento — Carla Mendonça",valor:1200,data:"2025-05-22"},
    {id:2,conta_id:2,tipo:"entrada",origem:"atendimento",descricao:"Recebimento — Ana Paula (PIX)",valor:800,data:"2025-05-20"},
    {id:3,conta_id:2,tipo:"entrada",origem:"atendimento",descricao:"Recebimento — Beatriz (Débito)",valor:250,data:"2025-05-21"},
  ],
  estoque_movimentacoes:[
    {id:1,produto_id:1,tipo:"entrada",quantidade:5,custo_unitario:800,custo_total:4000,estoque_anterior:0,estoque_atual:5,origem:"compra",data:"2025-05-01"},
    {id:2,produto_id:2,tipo:"entrada",quantidade:8,custo_unitario:250,custo_total:2000,estoque_anterior:0,estoque_atual:8,origem:"compra",data:"2025-05-01"},
    {id:3,produto_id:1,tipo:"saida",quantidade:0.5,custo_unitario:800,custo_total:400,estoque_anterior:5,estoque_atual:4.5,origem:"uso_procedimento",data:"2025-05-20"},
  ],
  campanhas:[],
  atendimento_itens:[
    {id:1,atendimento_id:1,tipo:"procedimento",procedimento_id:1,produto_id:null,descricao:"Botox Facial",quantidade:1,valor_unitario:800,valor_total:800},
    {id:2,atendimento_id:2,tipo:"procedimento",procedimento_id:3,produto_id:null,descricao:"Limpeza de Pele",quantidade:1,valor_unitario:250,valor_total:250},
    {id:3,atendimento_id:3,tipo:"procedimento",procedimento_id:2,produto_id:null,descricao:"Preenchimento Labial",quantidade:1,valor_unitario:1200,valor_total:1200},
  ],
  comissoes:[
    {id:1,atendimento_id:1,profissional_id:1,paciente:"Ana Paula Silva",servico:"Botox Facial",valor_atendimento:800,percentual:40,valor_comissao:320,status:"pendente",data_atendimento:"2025-05-20"},
    {id:2,atendimento_id:3,profissional_id:1,paciente:"Carla Mendonça",servico:"Preenchimento Labial",valor_atendimento:1200,percentual:40,valor_comissao:480,status:"paga",data_atendimento:"2025-05-22",data_pagamento:"2025-05-25",conta_id:1},
  ],
  caixa_diario:[],
  salas:[
    {id:1,nome:"Sala 1 - Estética Facial",descricao:"18m², maca elétrica, espelho iluminado",valor_aluguel:1500,status:"alugada",locatario_nome:"Juliana Freitas",locatario_cpf:"123.456.789-00",locatario_telefone:"(11)98888-4444",contrato_inicio:"2025-01-10",contrato_fim:"2025-12-31",contrato_arquivo_nome:"",contrato_arquivo_base64:""},
    {id:2,nome:"Sala 2 - Estética Corporal",descricao:"22m², maca de massagem, ducha",valor_aluguel:1800,status:"disponivel"},
  ],
  aluguel_pagamentos:[
    {id:1,sala_id:1,referencia:"Maio/2025",valor:1500,vencimento:"2025-05-05",status:"quitado",data_pagamento:"2025-05-04",conta_id:2},
  ],
  horarios_profissional:[
    /* Dra. Camila Rocha (id:1) — seg a sex, 9h-18h */
    ...[1,2,3,4,5].map(dia=>({id:dia,profissional_id:1,dia_semana:dia,hora_inicio:"09:00",hora_fim:"18:00",ativo:true})),
    /* Dra. Fernanda Lima (id:2) — seg a sáb, 8h-17h */
    ...[1,2,3,4,5,6].map(dia=>({id:10+dia,profissional_id:2,dia_semana:dia,hora_inicio:"08:00",hora_fim:"17:00",ativo:true})),
    /* Vitória Mendes (id:3) — ter a sáb, 10h-19h */
    ...[2,3,4,5,6].map(dia=>({id:20+dia,profissional_id:3,dia_semana:dia,hora_inicio:"10:00",hora_fim:"19:00",ativo:true})),
  ],
  bloqueios_agenda:[],
  compra_itens:[
    {id:1,conta_pagar_id:1,produto_id:1,quantidade:5,custo_unitario:800,custo_total:4000,fornecedor_id:1,data:"2025-05-01"},
    {id:2,conta_pagar_id:1,produto_id:2,quantidade:8,custo_unitario:250,custo_total:2000,fornecedor_id:1,data:"2025-05-01"},
  ],
});

/* ─── UTILS ──────────────────────────────────────────────────── */
const fmt = v => (Number(v)||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const fmtN = v => (Number(v)||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const today = () => new Date().toISOString().split("T")[0];
const mesAtualRange = () => { const h=new Date(); const de=new Date(h.getFullYear(),h.getMonth(),1); const ate=new Date(h.getFullYear(),h.getMonth()+1,0); return {de:de.toISOString().split("T")[0], ate:ate.toISOString().split("T")[0]}; };

/* Estrutura padrão de DRE gerencial — os 7 grupos são fixos (formato de mercado);
   as contas dentro de cada grupo são livres/cadastráveis pelo usuário.        */
const GRUPOS_DRE = [
  {id:"receita_bruta",         label:"Receita Operacional Bruta",       tipo:"receita"},
  {id:"deducoes",               label:"Deduções da Receita",             tipo:"despesa"},
  {id:"custos",                 label:"Custo dos Serviços Prestados",    tipo:"despesa"},
  {id:"despesas_operacionais",  label:"Despesas Operacionais",           tipo:"despesa"},
  {id:"receitas_financeiras",   label:"Receitas Financeiras",            tipo:"receita"},
  {id:"despesas_financeiras",   label:"Despesas Financeiras",            tipo:"despesa"},
  {id:"impostos_lucro",         label:"Impostos sobre o Lucro (IR/CSLL)",tipo:"despesa"},
];
const grupoDRE = (id) => GRUPOS_DRE.find(g=>g.id===id);
const fmtDate = d => d?new Date(d+"T12:00:00").toLocaleDateString("pt-BR"):"-";
const _fmtDateISO = d => { if(!d)return""; const p=d.split("/"); return p.length===3?`${p[2]}-${p[1]}-${p[0]}`:d; }; // eslint-disable-line
const maskCPF = v => v.replace(/\D/g,"").slice(0,11).replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d{1,2})$/,"$1-$2");
const maskFone = v => v.replace(/\D/g,"").slice(0,11).replace(/(\d{2})(\d{5})(\d)/,"($1) $2-$3");
const maskCNPJ = v => v.replace(/\D/g,"").slice(0,14).replace(/(\d{2})(\d)/,"$1.$2").replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d)/,"$1/$2").replace(/(\d{4})(\d{1,2})$/,"$1-$2");
const maskCEP = v => v.replace(/\D/g,"").slice(0,8).replace(/(\d{5})(\d)/,"$1-$2");
const maskCpfCnpj = v => v.replace(/\D/g,"").length>11 ? maskCNPJ(v) : maskCPF(v);


/* ─── ÍCONES ─────────────────────────────────────────────────── */
/* ─── LOGO VPBEAUTY ──────────────────────────────────────────── */
const Logo = ({size=40}) => (
  <svg width={size} height={size*0.54} viewBox="0 0 260 140" role="img" aria-label="VPBeauty">
    <rect x="4" y="4" width="252" height="132" rx="10" fill="#F1E9FC" stroke="#B8960C" strokeWidth="1.5"/>
    <rect x="12" y="12" width="236" height="116" rx="4" fill="none" stroke="#B8960C" strokeWidth="0.5"/>
    <text x="130" y="80" textAnchor="middle" fontFamily="Georgia, serif" fontSize="38" fontWeight="400" fill="#5B3F8C" letterSpacing="5">VP</text>
    <text x="130" y="106" textAnchor="middle" fontFamily="Georgia, serif" fontSize="14" fill="#B8960C" letterSpacing="6">BEAUTY</text>
  </svg>
);

const LogoMark = ({size=28}) => (
  <svg width={size} height={size} viewBox="0 0 40 40" role="img" aria-label="VPBeauty">
    <rect x="1" y="1" width="38" height="38" rx="9" fill="#F1E9FC" stroke="#B8960C" strokeWidth="1"/>
    <text x="20" y="26" textAnchor="middle" fontFamily="Georgia, serif" fontSize="16" fontWeight="400" fill="#5B3F8C" letterSpacing="1">VP</text>
  </svg>
);

const I = {
  Sparkle:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill={c} stroke="none"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>,
  Grid:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  Cal:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  User:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Users:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Up:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  Dollar:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  Plus:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Check:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  X:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Tag:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  Box:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  Receipt:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/></svg>,
  Send:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  Warn:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  Eye:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  EyeOff:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  File:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  Download:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  Edit:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Lock:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  Out:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Arrow:({c="currentColor",s=16,style})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={style}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  Shield:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Star:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill={c} stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  Zap:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  Menu:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  Bar:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  Phone:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.73 16z"/></svg>,
  Diamond:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41L13.7 2.71a2.41 2.41 0 0 0-3.41 0L2.7 10.3z"/></svg>,
  Scissors:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>,
  Truck:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  Bank:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>,
  Clipboard:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>,
  Megaphone:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>,
  Settings:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  Calculator:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="12" y1="10" x2="14" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="12" y1="14" x2="14" y2="14"/><line x1="16" y1="14" x2="16" y2="18"/><line x1="8" y1="18" x2="10" y2="18"/><line x1="12" y1="18" x2="14" y2="18"/></svg>,
  Refresh:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
  Filter:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  Whatsapp:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill={c} stroke="none"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.5 2C6.262 2 2 6.262 2 11.5c0 1.869.524 3.617 1.438 5.105L2 22l5.535-1.42C9.004 21.491 10.22 22 11.5 22c5.238 0 9.5-4.262 9.5-9.5S16.738 2 11.5 2zm0 17.4c-1.599 0-3.086-.483-4.325-1.309l-.31-.186-3.286.843.874-3.197-.203-.328A7.895 7.895 0 0 1 3.6 11.5C3.6 7.14 7.14 3.6 11.5 3.6S19.4 7.14 19.4 11.5 15.86 19.4 11.5 19.4z"/></svg>,
  Email:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  Excel:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  Pen:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>,
  ShoppingCart:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
  CreditCard:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  ArrowUpDown:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>,
};

/* ─── CSS ────────────────────────────────────────────────────── */
const GS = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@300;400;500;600;700&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
    body{background:#FAF7FF;font-family:'Inter',sans-serif;overflow-x:hidden;color:#332845}
    .cm{font-family:'Playfair Display',serif}
    @keyframes fu{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
    @keyframes fi{from{opacity:0}to{opacity:1}}
    @keyframes gl{0%,100%{box-shadow:0 0 16px #B8960C22}50%{box-shadow:0 0 30px #B8960C3A}}
    @keyframes sp{from{transform:rotate(0)}to{transform:rotate(360deg)}}
    @keyframes sk{0%,100%{transform:translateX(0)}25%,75%{transform:translateX(-5px)}50%{transform:translateX(5px)}}
    .fu{animation:fu .55s ease both}
    .fi{animation:fi .3s ease both}
    .gl{animation:gl 2.5s ease infinite}
    .sp{animation:sp 1s linear infinite}
    .sk{animation:sk .35s ease}
    .d1{animation-delay:.07s}.d2{animation-delay:.14s}.d3{animation-delay:.21s}.d4{animation-delay:.28s}.d5{animation-delay:.35s}
    ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#F1EAFA}::-webkit-scrollbar-thumb{background:#C6B4E0;border-radius:3px}
    input,select,textarea{-webkit-appearance:none;appearance:none;font-family:'Inter',sans-serif;font-size:16px}
    input[type="checkbox"],input[type="radio"]{-webkit-appearance:auto;appearance:auto;width:auto;height:auto}
    input:focus,select:focus,textarea:focus{outline:none!important;border-color:#7C5CBF!important;box-shadow:0 0 0 3px #7C5CBF14}
    button{cursor:pointer;font-family:'Inter',sans-serif;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
    /* hover effects */
    .gb:hover{background:#8E6FCC!important;transform:translateY(-1px)}
    .ob:hover{background:#7C5CBF0C!important;border-color:#7C5CBF!important;color:#5B3F8C!important}
    .nb:hover{background:#7C5CBF12!important;color:#5B3F8C!important}
    .fc:hover{border-color:#B8960C55!important;transform:translateY(-2px);box-shadow:0 4px 16px #7C5CBF14}
    .nl:hover{color:#7C5CBF!important}
    *{transition:color .15s,border-color .15s,background .18s,transform .18s,box-shadow .18s,opacity .15s}
    /* Barra mobile */
    .bottom-nav{display:none;position:fixed;bottom:0;left:0;right:0;z-index:900;background:#FFFFFF;border-top:1px solid #E8E0F5;padding:6px 0 env(safe-area-inset-bottom,6px);justify-content:space-around;align-items:center;box-shadow:0 -2px 12px #7C5CBF0A}
    .bn-item{display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px 8px;border:none;background:transparent;color:#8577A0;font-size:9px;font-weight:500;min-width:48px;border-radius:8px}
    .bn-item.active{color:#7C5CBF}
    /* Responsive */
    @media(min-width:769px){.sys-sidebar{display:flex!important}.bottom-nav{display:none!important}.sys-content{padding-bottom:16px!important}}
    @media(max-width:768px){.hs{display:none!important}.cs{flex-direction:column!important}.ws{width:100%!important}.g1{grid-template-columns:1fr!important}.g2{grid-template-columns:1fr 1fr!important}.ht{font-size:clamp(30px,8vw,52px)!important}.sys-sidebar{display:none!important}.bottom-nav{display:flex!important}.sys-content{padding-bottom:76px!important}.sys-topbar-menu{display:none!important}}
    @media(max-width:480px){.g2{grid-template-columns:1fr!important}.stat-row>div{min-width:calc(50% - 6px)!important;flex:1 1 calc(50% - 6px)!important}.hero-btns{flex-direction:column!important;align-items:stretch!important}.hero-btns button{width:100%!important;justify-content:center!important}}
    /* Signature pad */
    .sig-canvas{border:1.5px solid #E8E0F5;border-radius:10px;width:100%;height:160px;background:#FDFCFF;cursor:crosshair;touch-action:none}
  `}</style>
);


/* ─── UI PRIMITIVOS ──────────────────────────────────────────── */
const Spin = ({s=16,c="#fff"})=><div className="sp" style={{width:s,height:s,border:`2px solid ${c}28`,borderTop:`2px solid ${c}`,borderRadius:"50%",flexShrink:0}}/>;
const Badge = ({text,color})=><span style={{background:color+"20",color,padding:"2px 9px",borderRadius:20,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:.4,whiteSpace:"nowrap"}}>{text}</span>;

const SC = ({label,value,Icon,color,sub})=>(
  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:13,padding:"14px 16px",flex:1,minWidth:120,boxShadow:"0 1px 8px #7C5CBF0A"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
      <div>
        <div style={{color:C.muted,fontSize:10,textTransform:"uppercase",letterSpacing:.8,marginBottom:5}}>{label}</div>
        <div style={{color:C.text,fontSize:17,fontWeight:700}}>{value}</div>
        {sub&&<div style={{color:C.muted,fontSize:10,marginTop:2}}>{sub}</div>}
      </div>
      {Icon&&<div style={{background:color+"18",borderRadius:9,padding:7}}><Icon c={color} s={14}/></div>}
    </div>
  </div>
);

const Mod = ({title,onClose,children,wide,full})=>(
  <div style={{position:"fixed",inset:0,background:"#4A3D6280",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(4px)"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div className="fi" style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:22,width:full?"95vw":wide?700:460,maxWidth:"98vw",maxHeight:"92vh",overflowY:"auto",boxShadow:"0 20px 60px #4A3D6230"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,position:"sticky",top:0,background:C.card,paddingBottom:10,borderBottom:`1px solid ${C.border}`,zIndex:10}}>
        <span style={{color:C.text,fontWeight:700,fontSize:14}}>{title}</span>
        <button onClick={onClose} style={{background:"none",border:"none",color:C.muted}}><I.X c={C.muted} s={17}/></button>
      </div>
      {children}
    </div>
  </div>
);

const Inp = ({label,err,...p})=>(
  <div style={{marginBottom:11}}>
    {label&&<label style={{display:"block",color:C.muted,fontSize:10,letterSpacing:.9,textTransform:"uppercase",marginBottom:4}}>{label}</label>}
    <input {...p} style={{width:"100%",background:C.surface,border:`1px solid ${err?C.danger:C.border}`,borderRadius:8,padding:"9px 12px",color:C.text,fontSize:13,...p.style}}/>
    {err&&<span style={{color:C.danger,fontSize:10,marginTop:2,display:"block"}}>{err}</span>}
  </div>
);

const Sel = ({label,options,...p})=>(
  <div style={{marginBottom:11}}>
    {label&&<label style={{display:"block",color:C.muted,fontSize:10,letterSpacing:.9,textTransform:"uppercase",marginBottom:4}}>{label}</label>}
    <select {...p} style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.text,fontSize:13}}>
      {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const TA = ({label,...p})=>(
  <div style={{marginBottom:11}}>
    {label&&<label style={{display:"block",color:C.muted,fontSize:10,letterSpacing:.9,textTransform:"uppercase",marginBottom:4}}>{label}</label>}
    <textarea {...p} style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.text,fontSize:13,resize:"vertical",minHeight:64,...p.style}}/>
  </div>
);

const Btn = ({children,v="p",onClick,style:s={},disabled,type="button"})=>{
  const vs={p:{background:C.accent,color:"#FFFFFF",border:"none"},g:{background:"transparent",color:C.muted,border:`1px solid ${C.border}`},d:{background:C.danger+"20",color:C.danger,border:`1px solid ${C.danger}44`},ok:{background:C.success+"20",color:C.success,border:`1px solid ${C.success}44`},i:{background:C.info+"20",color:C.info,border:`1px solid ${C.info}44`},warn:{background:C.warn+"20",color:C.warn,border:`1px solid ${C.warn}44`}};
  return <button type={type} onClick={onClick} disabled={disabled} style={{padding:"8px 14px",borderRadius:8,fontWeight:600,fontSize:12,display:"inline-flex",alignItems:"center",gap:5,opacity:disabled?.5:1,...vs[v],...s}}>{children}</button>;
};

const PH = ({title,sub,children})=>(
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
    <div><h2 style={{color:C.text,fontSize:17,fontWeight:700,marginBottom:2}}>{title}</h2>{sub&&<p style={{color:C.muted,fontSize:12}}>{sub}</p>}</div>
    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{children}</div>
  </div>
);

/* ─── FILTRO BAR ─────────────────────────────────────────────── */
const FilterBar = ({filters, values, onChange}) => (
  <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",background:C.surface,borderRadius:10,padding:"10px 12px",border:`1px solid ${C.border}`}}>
    <I.Filter c={C.muted} s={14}/>
    {filters.map(f=>{
      if(f.type==="select") return (
        <select key={f.key} value={values[f.key]||""} onChange={e=>onChange(f.key,e.target.value)}
          style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:7,padding:"5px 10px",color:values[f.key]?C.text:C.muted,fontSize:12,minWidth:120}}>
          <option value="">{f.label}</option>
          {f.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
      if(f.type==="date") return (
        <input key={f.key} type="date" value={values[f.key]||""} onChange={e=>onChange(f.key,e.target.value)}
          placeholder={f.label} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:7,padding:"5px 10px",color:C.text,fontSize:12,minWidth:130}}/>
      );
      if(f.type==="text") return (
        <input key={f.key} type="text" value={values[f.key]||""} onChange={e=>onChange(f.key,e.target.value)}
          placeholder={f.label} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:7,padding:"5px 10px",color:C.text,fontSize:12,minWidth:140}}/>
      );
      return null;
    })}
    {Object.values(values).some(v=>v) &&
      <button onClick={()=>filters.forEach(f=>onChange(f.key,""))}
        style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:7,padding:"5px 10px",color:C.muted,fontSize:11,display:"flex",alignItems:"center",gap:4}}>
        <I.X c={C.muted} s={11}/> Limpar
      </button>
    }
  </div>
);

/* ─── BUSCA DE PACIENTE COM AUTOCOMPLETE + CADASTRO RÁPIDO ──────
   Sempre vincula pelo paciente_id real do cadastro — nunca texto livre.
   Se o paciente não existir, o botão "+" abre um cadastro rápido.     */
const PacienteBusca = ({pacientes, value, onChange, insert, label="Paciente"}) => {
  const [busca,setBusca] = useState("");
  const [aberto,setAberto] = useState(false);
  const [modalNovo,setModalNovo] = useState(false);
  const [novoNome,setNovoNome] = useState("");
  const [novoTel,setNovoTel] = useState("");
  const [salvando,setSalvando] = useState(false);
  const wrapRef = useRef(null);

  const selecionado = pacientes.find(p=>String(p.id)===String(value));

  useEffect(()=>{
    const fechar = e => { if(wrapRef.current && !wrapRef.current.contains(e.target)) setAberto(false); };
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  },[]);

  const filtrados = useMemo(()=>{
    if(!busca.trim()) return pacientes.slice(0,8);
    const b = busca.toLowerCase();
    return pacientes.filter(p=>p.nome.toLowerCase().includes(b)||p.cpf?.includes(busca)||p.telefone?.includes(busca)).slice(0,8);
  },[busca,pacientes]);

  const escolher = (p) => { onChange(p.id, p.nome); setBusca(""); setAberto(false); };

  const abrirCadastroRapido = () => { setNovoNome(busca); setNovoTel(""); setModalNovo(true); setAberto(false); };

  const salvarNovoPaciente = async () => {
    if(!novoNome.trim()) return;
    setSalvando(true);
    const novo = await insert("pacientes",{nome:novoNome.trim(),telefone:novoTel,whatsapp:novoTel});
    setSalvando(false);
    if(novo){ onChange(novo.id, novo.nome); }
    setModalNovo(false); setBusca("");
  };

  return (
    <div style={{marginBottom:11,position:"relative"}} ref={wrapRef}>
      <label style={{display:"block",color:C.muted,fontSize:10,letterSpacing:.9,textTransform:"uppercase",marginBottom:4}}>{label}</label>
      <div style={{display:"flex",gap:6}}>
        <div style={{flex:1,position:"relative"}}>
          <input
            type="text"
            value={aberto ? busca : (selecionado?.nome||"")}
            onFocus={()=>{setAberto(true); setBusca("");}}
            onChange={e=>{setBusca(e.target.value); setAberto(true); if(value) onChange("","");}}
            placeholder="Digite o nome para buscar..."
            style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.text,fontSize:13}}
          />
          {aberto&&(
            <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,boxShadow:"0 8px 24px #4A3D6225",zIndex:50,maxHeight:220,overflowY:"auto"}}>
              {filtrados.length===0
                ? <div style={{padding:"12px 14px",color:C.muted,fontSize:12}}>Nenhum paciente encontrado.</div>
                : filtrados.map(p=>(
                    <button key={p.id} onClick={()=>escolher(p)} style={{width:"100%",textAlign:"left",padding:"9px 14px",background:"transparent",border:"none",borderBottom:`1px solid ${C.border}`,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <div style={{color:C.text,fontSize:12,fontWeight:600}}>{p.nome}</div>
                        <div style={{color:C.muted,fontSize:10}}>{p.telefone||p.whatsapp||"sem telefone"}</div>
                      </div>
                    </button>
                  ))
              }
              <button onClick={abrirCadastroRapido} style={{width:"100%",textAlign:"left",padding:"10px 14px",background:C.accentSoft,border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:7}}>
                <I.Plus c={C.accent} s={13}/>
                <span style={{color:C.accent,fontSize:12,fontWeight:600}}>{busca.trim()?`Cadastrar "${busca.trim()}" como novo paciente`:"Cadastrar novo paciente"}</span>
              </button>
            </div>
          )}
        </div>
        <button type="button" onClick={abrirCadastroRapido} title="Cadastrar novo paciente"
          style={{background:C.accentSoft,border:`1px solid ${C.accent}40`,borderRadius:8,width:38,flexShrink:0,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <I.Plus c={C.accent} s={16}/>
        </button>
      </div>

      {modalNovo&&<Mod title="Cadastro Rápido de Paciente" onClose={()=>setModalNovo(false)}>
        <Inp label="Nome completo" value={novoNome} onChange={e=>setNovoNome(e.target.value)} placeholder="Nome do paciente"/>
        <Inp label="Telefone / WhatsApp" value={novoTel} onChange={e=>setNovoTel(maskFone(e.target.value))} placeholder="(11) 99999-9999"/>
        <div style={{background:C.info+"10",border:`1px solid ${C.info}25`,borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:11,color:C.info}}>
          Cadastro simplificado. Você pode completar CPF, e-mail e demais dados depois em Pacientes.
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Btn v="g" onClick={()=>setModalNovo(false)}>Cancelar</Btn>
          <Btn onClick={salvarNovoPaciente} disabled={!novoNome.trim()||salvando}>
            {salvando?<><Spin s={12} c="#FFFFFF"/>Salvando...</>:<><I.Check s={12}/> Cadastrar e Usar</>}
          </Btn>
        </div>
      </Mod>}
    </div>
  );
};

/* ─── TABELA ─────────────────────────────────────────────────── */
const ST = ({cols,rows,empty="Nenhum registro encontrado."})=>(
  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:13,overflow:"hidden",boxShadow:"0 1px 8px #7C5CBF0A"}}>
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",minWidth:460}}>
        <thead><tr style={{background:"#F7F2FC"}}>
          {cols.map(h=><th key={h} style={{padding:"9px 13px",textAlign:"left",color:C.muted,fontSize:10,textTransform:"uppercase",letterSpacing:.8,fontWeight:600,whiteSpace:"nowrap"}}>{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.length===0
            ? <tr><td colSpan={cols.length} style={{padding:"24px",textAlign:"center",color:C.muted,fontSize:13}}>{empty}</td></tr>
            : rows.map((row,i)=><tr key={i} style={{borderTop:`1px solid ${C.border}`}}>
                {row.map((cell,j)=><td key={j} style={{padding:"10px 13px",color:C.text,fontSize:12}}>{cell}</td>)}
              </tr>)
          }
        </tbody>
      </table>
    </div>
  </div>
);

/* ─── HOOK DE DADOS ──────────────────────────────────────────────
   clinicaId = UUID do auth.uid() no Supabase
   Em modo demo usa dados locais sem nenhuma chamada de rede        */
function useData(clinicaId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    /* Modo demo — carrega dados simulados */
    if (DEMO_MODE || !clinicaId) {
      setData(mkDemo());
      setLoading(false);
      return;
    }

    /* Modo real — lê cada tabela filtrando pelo clinica_id do usuário logado */
    const cid = clinicaId;
    try {
      const [
        profissionais, fornecedores, produtos, procedimentos,
        procedimento_insumos, formas_pagamento, contas_bancarias,
        pacientes, anamneses, agendamentos, atendimentos,
        despesas_fixas, despesas_variaveis,
        contas_receber, contas_pagar, categorias_financeiras, contas_dre,
        movimentacoes, estoque_movimentacoes,
        campanhas, atendimento_itens, compra_itens, comissoes, caixa_diario,
        salas, aluguel_pagamentos, horarios_profissional, bloqueios_agenda,
      ] = await Promise.all([
        sb.get("profissionais",       `clinica_id=eq.${cid}&ativo=eq.true`),
        sb.get("fornecedores",        `clinica_id=eq.${cid}&ativo=eq.true`),
        sb.get("produtos",            `clinica_id=eq.${cid}&ativo=eq.true`),
        sb.get("procedimentos",       `clinica_id=eq.${cid}&ativo=eq.true`),
        sb.get("procedimento_insumos",`clinica_id=eq.${cid}`),
        sb.get("formas_pagamento",    `clinica_id=eq.${cid}&ativo=eq.true`),
        sb.get("contas_bancarias",    `clinica_id=eq.${cid}&ativo=eq.true`),
        sb.get("pacientes",           `clinica_id=eq.${cid}`),
        sb.get("anamneses",           `clinica_id=eq.${cid}`),
        sb.get("agendamentos",        `clinica_id=eq.${cid}&order=data.desc`),
        sb.get("atendimentos",        `clinica_id=eq.${cid}&order=data.desc`),
        sb.get("despesas_fixas",      `clinica_id=eq.${cid}`),
        sb.get("despesas_variaveis",  `clinica_id=eq.${cid}`),
        sb.get("contas_receber",      `clinica_id=eq.${cid}&order=vencimento.asc`),
        sb.get("contas_pagar",        `clinica_id=eq.${cid}&order=vencimento.asc`),
        sb.get("categorias_financeiras",`clinica_id=eq.${cid}&order=nome.asc`),
        sb.get("contas_dre",          `clinica_id=eq.${cid}&order=ordem.asc`),
        sb.get("movimentacoes",       `clinica_id=eq.${cid}&order=data.desc`),
        sb.get("estoque_movimentacoes",`clinica_id=eq.${cid}&order=data.desc`),
        sb.get("campanhas",           `clinica_id=eq.${cid}&order=created_at.desc`),
        sb.get("atendimento_itens",   `clinica_id=eq.${cid}`),
        sb.get("compra_itens",        `clinica_id=eq.${cid}`),
        sb.get("comissoes",           `clinica_id=eq.${cid}&order=data_atendimento.desc`),
        sb.get("caixa_diario",        `clinica_id=eq.${cid}&order=data.desc`),
        sb.get("salas",               `clinica_id=eq.${cid}`),
        sb.get("aluguel_pagamentos",  `clinica_id=eq.${cid}&order=vencimento.desc`),
        sb.get("horarios_profissional",`clinica_id=eq.${cid}`),
        sb.get("bloqueios_agenda",    `clinica_id=eq.${cid}&order=data_inicio.desc`),
      ]);

      setData({
        profissionais, fornecedores, produtos, procedimentos,
        procedimento_insumos, formas_pagamento, contas_bancarias,
        pacientes, anamneses, agendamentos, atendimentos,
        despesas_fixas, despesas_variaveis,
        contas_receber, contas_pagar, categorias_financeiras, contas_dre,
        movimentacoes, estoque_movimentacoes,
        campanhas, atendimento_itens, compra_itens, comissoes, caixa_diario,
        salas, aluguel_pagamentos, horarios_profissional, bloqueios_agenda,
      });
    } catch (e) {
      console.error("Erro ao carregar dados:", e);
      /* Fallback para demo se conexão falhar */
      setData(mkDemo());
    }
    setLoading(false);
  }, [clinicaId]);

  useEffect(() => { load(); }, [load]);

  /* Atualiza um registro — real ou demo */
  const update = async (tabela, id, alteracoes) => {
    if (DEMO_MODE) {
      setData(prev => ({
        ...prev,
        [tabela]: prev[tabela].map(r => r.id === id ? { ...r, ...alteracoes } : r),
      }));
      return;
    }
    await sb.patch(tabela, id, alteracoes);
    load();
  };

  /* Insere um registro — injeta clinica_id automaticamente */
  const insert = async (tabela, registro) => {
    const comClinica = { ...registro, clinica_id: clinicaId };

    if (DEMO_MODE) {
      const novo = { ...comClinica, id: Date.now() };
      setData(prev => ({ ...prev, [tabela]: [...(prev[tabela] || []), novo] }));
      return novo;
    }
    const criado = await sb.post(tabela, comClinica);
    if (!criado) {
      /* Grava falhou de verdade no Supabase — avisa quem chamou em vez de
         fingir sucesso. Detalhe do erro real já foi logado por sb.post no console. */
      throw new Error(`Não foi possível salvar em "${tabela}". Verifique o Console (F12) para o erro detalhado do Supabase.`);
    }
    load();
    return criado;
  };

  /* Remove um registro — real ou demo */
  const remove = async (tabela, id) => {
    if (DEMO_MODE) {
      setData(prev => ({ ...prev, [tabela]: prev[tabela].filter(r => r.id !== id) }));
      return;
    }
    await sb.del(tabela, id);
    load();
  };

  return { data, loading, update, insert, remove, reload: load };
}


/* ─── ASSINATURA DIGITAL ─────────────────────────────────────── */
function SignaturePad({ onSave, onCancel }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - rect.left) * (canvas.width / rect.width), y: (src.clientY - rect.top) * (canvas.height / rect.height) };
  };

  const start = e => { e.preventDefault(); setDrawing(true); const c = canvasRef.current; const ctx = c.getContext("2d"); const p = getPos(e, c); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  const draw = e => { e.preventDefault(); if (!drawing) return; const c = canvasRef.current; const ctx = c.getContext("2d"); ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.strokeStyle = "#C8A96A"; const p = getPos(e, c); ctx.lineTo(p.x, p.y); ctx.stroke(); setHasSignature(true); };
  const end = () => setDrawing(false);
  const clear = () => { const c = canvasRef.current; c.getContext("2d").clearRect(0, 0, c.width, c.height); setHasSignature(false); };
  const save = () => { if (!hasSignature) return; onSave(canvasRef.current.toDataURL("image/png")); };

  return (
    <div>
      <p style={{color:C.muted,fontSize:12,marginBottom:10}}>Assine abaixo com o dedo ou mouse:</p>
      <canvas ref={canvasRef} width={600} height={160} className="sig-canvas"
        onMouseDown={start} onMouseMove={draw} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={draw} onTouchEnd={end}
      />
      <div style={{display:"flex",gap:8,marginTop:10,justifyContent:"space-between"}}>
        <Btn v="g" onClick={clear}><I.Refresh s={12}/> Limpar</Btn>
        <div style={{display:"flex",gap:8}}>
          <Btn v="g" onClick={onCancel}>Cancelar</Btn>
          <Btn onClick={save} disabled={!hasSignature}><I.Pen s={12}/> Confirmar Assinatura</Btn>
        </div>
      </div>
    </div>
  );
}

/* ─── ANAMNESE MODAL ─────────────────────────────────────────── */
/* Checkbox/Radio da Anamnese — componentes independentes para não
   remontar a cada tecla digitada em outros campos do mesmo formulário. */
const ChkBox = ({label,k,form,toggle}) => (
  <label style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",padding:"5px 0"}}>
    <input type="checkbox" checked={!!form[k]} onChange={()=>toggle(k)} style={{width:15,height:15,accentColor:C.accent}}/>
    <span style={{color:C.text,fontSize:13}}>{label}</span>
  </label>
);
const Radio = ({label,k,value,form,onChange}) => ( // eslint-disable-line no-unused-vars
  <label style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",padding:"4px 0"}}>
    <input type="radio" name={k} value={value} checked={form[k]===value} onChange={()=>onChange(k,value)} style={{accentColor:C.accent}}/>
    <span style={{color:C.text,fontSize:13}}>{label}</span>
  </label>
);

function AnamneseModal({ paciente, existente, onClose, onSave }) {
  const [step, setStep] = useState(1);
  const totalSteps = 5;
  const [form, setForm] = useState(existente || {
    estado_saude_geral:"",medicamentos:"",alergias:"",alergias_cosmeticos:"",
    problemas_cardiacos:false,diabetes:false,hipertensao:false,tireoide:false,epilepsia:false,
    gestante:false,amamentando:false,oncologico:false,autoimune:false,outras_doencas:"",
    tipo_pele:"",sensibilidade_pele:"",manchas:false,acne:false,cicatrizes:false,
    procedimentos_anteriores:"",reacoes_anteriores:"",uso_acido:false,uso_retinol:false,protetor_solar:false,
    fumante:false,alcool:"",atividade_fisica:"",alimentacao:"",qualidade_sono:"",nivel_estresse:"",
    areas_interesse:[],objetivo_principal:"",expectativas:"",contraindicacoes:"",
    termo_aceito:false,assinatura_base64:"",assinado_em:"",
  });
  const [showSig, setShowSig] = useState(false);
  const f = (k,v) => setForm(p=>({...p,[k]:v}));
  const toggle = (k) => setForm(p=>({...p,[k]:!p[k]}));

  const handleSig = (b64) => { f("assinatura_base64",b64); f("assinado_em",new Date().toISOString()); setShowSig(false); };

  if (showSig) return (
    <Mod title="Assinatura Digital" onClose={()=>setShowSig(false)} wide>
      <SignaturePad onSave={handleSig} onCancel={()=>setShowSig(false)}/>
    </Mod>
  );

  return (
    <Mod title={`Anamnese — ${paciente.nome}`} onClose={onClose} wide>
      {/* Steps */}
      <div style={{display:"flex",alignItems:"center",marginBottom:18,gap:6}}>
        {Array.from({length:totalSteps},(_,i)=>(
          <div key={i} style={{flex:1,height:4,borderRadius:2,background:step>i?C.accent:step===i+1?C.accent+"60":C.border}}/>
        ))}
      </div>
      <div style={{color:C.muted,fontSize:11,marginBottom:14}}>Etapa {step} de {totalSteps} — {["Saúde Geral","Condições Especiais","Histórico de Pele","Hábitos de Vida","Objetivos & Assinatura"][step-1]}</div>

      {step===1&&<div className="fu">
        <h4 style={{color:C.accent,fontSize:12,fontWeight:700,marginBottom:12,textTransform:"uppercase",letterSpacing:1}}>Saúde Geral</h4>
        <TA label="Como está sua saúde geral atualmente?" value={form.estado_saude_geral} onChange={e=>f("estado_saude_geral",e.target.value)} placeholder="Descreva brevemente..."/>
        <TA label="Medicamentos em uso (nome e dosagem)" value={form.medicamentos} onChange={e=>f("medicamentos",e.target.value)} placeholder="Ex: Losartana 50mg, Rivotril 0,5mg..."/>
        <TA label="Alergias conhecidas" value={form.alergias} onChange={e=>f("alergias",e.target.value)} placeholder="Medicamentos, alimentos, látex..."/>
        <TA label="Alergias a cosméticos/produtos de beleza" value={form.alergias_cosmeticos} onChange={e=>f("alergias_cosmeticos",e.target.value)} placeholder="Descreva se houver..."/>
        <TA label="Outras doenças ou condições relevantes" value={form.outras_doencas} onChange={e=>f("outras_doencas",e.target.value)} placeholder="Qualquer informação que o profissional deva saber..."/>
      </div>}

      {step===2&&<div className="fu">
        <h4 style={{color:C.accent,fontSize:12,fontWeight:700,marginBottom:12,textTransform:"uppercase",letterSpacing:1}}>Condições Especiais</h4>
        <p style={{color:C.muted,fontSize:11,marginBottom:12}}>Marque todas que se aplicam:</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
          <ChkBox label="Problemas cardíacos" k="problemas_cardiacos" form={form} toggle={toggle}/>
          <ChkBox label="Diabetes" k="diabetes" form={form} toggle={toggle}/>
          <ChkBox label="Hipertensão" k="hipertensao" form={form} toggle={toggle}/>
          <ChkBox label="Tireoide" k="tireoide" form={form} toggle={toggle}/>
          <ChkBox label="Epilepsia" k="epilepsia" form={form} toggle={toggle}/>
          <ChkBox label="Gestante" k="gestante" form={form} toggle={toggle}/>
          <ChkBox label="Amamentando" k="amamentando" form={form} toggle={toggle}/>
          <ChkBox label="Tratamento oncológico" k="oncologico" form={form} toggle={toggle}/>
          <ChkBox label="Doença autoimune" k="autoimune" form={form} toggle={toggle}/>
        </div>
        <div style={{marginTop:14,padding:"12px",background:C.warn+"12",borderRadius:9,border:`1px solid ${C.warn}30`}}>
          <p style={{color:C.warn,fontSize:11,fontWeight:600}}>⚠ Informações acima podem contraindicar procedimentos. Sempre informe ao profissional.</p>
        </div>
      </div>}

      {step===3&&<div className="fu">
        <h4 style={{color:C.accent,fontSize:12,fontWeight:700,marginBottom:12,textTransform:"uppercase",letterSpacing:1}}>Histórico de Pele</h4>
        <Sel label="Tipo de pele" value={form.tipo_pele} onChange={e=>f("tipo_pele",e.target.value)} options={[{value:"",label:"Selecione..."},{value:"normal",label:"Normal"},{value:"seca",label:"Seca"},{value:"oleosa",label:"Oleosa"},{value:"mista",label:"Mista"},{value:"sensivel",label:"Sensível"}]}/>
        <Sel label="Sensibilidade" value={form.sensibilidade_pele} onChange={e=>f("sensibilidade_pele",e.target.value)} options={[{value:"",label:"Selecione..."},{value:"nenhuma",label:"Nenhuma"},{value:"baixa",label:"Baixa"},{value:"moderada",label:"Moderada"},{value:"alta",label:"Alta"}]}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:12}}>
          <ChkBox label="Manchas" k="manchas" form={form} toggle={toggle}/>
          <ChkBox label="Acne ativa" k="acne" form={form} toggle={toggle}/>
          <ChkBox label="Cicatrizes" k="cicatrizes" form={form} toggle={toggle}/>
          <ChkBox label="Usa ácidos" k="uso_acido" form={form} toggle={toggle}/>
          <ChkBox label="Usa retinol" k="uso_retinol" form={form} toggle={toggle}/>
          <ChkBox label="Protetor solar diário" k="protetor_solar" form={form} toggle={toggle}/>
        </div>
        <TA label="Procedimentos estéticos anteriores" value={form.procedimentos_anteriores} onChange={e=>f("procedimentos_anteriores",e.target.value)} placeholder="Botox, preenchimento, laser, peelings..."/>
        <TA label="Reações a procedimentos anteriores" value={form.reacoes_anteriores} onChange={e=>f("reacoes_anteriores",e.target.value)} placeholder="Alergias, irritações, inchaços..."/>
      </div>}

      {step===4&&<div className="fu">
        <h4 style={{color:C.accent,fontSize:12,fontWeight:700,marginBottom:12,textTransform:"uppercase",letterSpacing:1}}>Hábitos de Vida</h4>
        <ChkBox label="Fumante" k="fumante" form={form} toggle={toggle}/>
        <Sel label="Consumo de álcool" value={form.alcool} onChange={e=>f("alcool",e.target.value)} options={[{value:"",label:"Selecione..."},{value:"nao",label:"Não consumo"},{value:"eventual",label:"Eventual"},{value:"moderado",label:"Moderado"},{value:"frequente",label:"Frequente"}]} />
        <Sel label="Atividade física" value={form.atividade_fisica} onChange={e=>f("atividade_fisica",e.target.value)} options={[{value:"",label:"Selecione..."},{value:"sedentario",label:"Sedentário"},{value:"leve",label:"Leve (1-2x/sem)"},{value:"moderado",label:"Moderado (3-4x/sem)"},{value:"intenso",label:"Intenso (5x+/sem)"}]}/>
        <Sel label="Qualidade do sono" value={form.qualidade_sono} onChange={e=>f("qualidade_sono",e.target.value)} options={[{value:"",label:"Selecione..."},{value:"otimo",label:"Ótimo (7-9h regulares)"},{value:"bom",label:"Bom (6-7h)"},{value:"irregular",label:"Irregular"},{value:"ruim",label:"Ruim (insônia)"}]}/>
        <Sel label="Nível de estresse" value={form.nivel_estresse} onChange={e=>f("nivel_estresse",e.target.value)} options={[{value:"",label:"Selecione..."},{value:"baixo",label:"Baixo"},{value:"moderado",label:"Moderado"},{value:"alto",label:"Alto"},{value:"muito_alto",label:"Muito alto"}]}/>
        <TA label="Alimentação (descreva brevemente)" value={form.alimentacao} onChange={e=>f("alimentacao",e.target.value)} placeholder="Dieta equilibrada, vegetariana, muita gordura..."/>
      </div>}

      {step===5&&<div className="fu">
        <h4 style={{color:C.accent,fontSize:12,fontWeight:700,marginBottom:12,textTransform:"uppercase",letterSpacing:1}}>Objetivos e Assinatura</h4>
        <TA label="Principal objetivo com os tratamentos" value={form.objetivo_principal} onChange={e=>f("objetivo_principal",e.target.value)} placeholder="Rejuvenescimento, eliminar manchas, definir rosto..."/>
        <TA label="Expectativas e observações" value={form.expectativas} onChange={e=>f("expectativas",e.target.value)} placeholder="Expectativas realistas, dúvidas, histórico..."/>

        {/* Termo */}
        <div style={{background:C.surface,borderRadius:9,padding:13,marginBottom:12,maxHeight:120,overflowY:"auto",border:`1px solid ${C.border}`}}>
          <p style={{color:C.mutedLt,fontSize:11,lineHeight:1.7}}>
            TERMO DE CONSENTIMENTO — Declaro que as informações prestadas nesta ficha de anamnese são verdadeiras e completas. Autorizo a realização dos procedimentos estéticos indicados pelo profissional responsável, tendo sido esclarecida sobre os benefícios, riscos e cuidados necessários. Estou ciente de que os resultados podem variar e que me comprometo a seguir as orientações pós-procedimento fornecidas. Autorizo também o uso de imagens para fins de acompanhamento clínico. Data: {new Date().toLocaleDateString("pt-BR")}.
          </p>
        </div>
        <label style={{display:"flex",alignItems:"flex-start",gap:8,cursor:"pointer",marginBottom:14}}>
          <input type="checkbox" checked={form.termo_aceito} onChange={e=>f("termo_aceito",e.target.checked)} style={{marginTop:3,accentColor:C.accent}}/>
          <span style={{color:C.text,fontSize:12,lineHeight:1.5}}>Li e concordo com o termo de consentimento acima</span>
        </label>

        {/* Assinatura */}
        <div style={{background:C.surface,borderRadius:9,padding:12,border:`1px solid ${C.border}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{color:C.muted,fontSize:11,textTransform:"uppercase",letterSpacing:.8}}>Assinatura Digital</span>
            {form.assinatura_base64
              ? <Badge text="✓ Assinado" color={C.success}/>
              : <Badge text="Pendente" color={C.warn}/>
            }
          </div>
          {form.assinatura_base64
            ? <div>
                <img src={form.assinatura_base64} alt="Assinatura" style={{width:"100%",maxHeight:80,objectFit:"contain",filter:"invert(1) sepia(1) saturate(5) hue-rotate(5deg)",background:"transparent"}}/>
                <div style={{color:C.muted,fontSize:10,marginTop:4}}>Assinado em: {form.assinado_em?new Date(form.assinado_em).toLocaleString("pt-BR"):"-"}</div>
                <Btn v="g" onClick={()=>setShowSig(true)} style={{marginTop:8,fontSize:10,padding:"4px 10px"}}><I.Pen s={11}/> Reassinar</Btn>
              </div>
            : <Btn v="warn" onClick={()=>setShowSig(true)} style={{width:"100%",justifyContent:"center"}}><I.Pen s={13}/> Coletar Assinatura Digital</Btn>
          }
        </div>
      </div>}

      <div style={{display:"flex",justifyContent:"space-between",marginTop:16}}>
        <Btn v="g" onClick={()=>step>1?setStep(s=>s-1):onClose()}>← {step>1?"Anterior":"Cancelar"}</Btn>
        {step<totalSteps
          ? <Btn onClick={()=>setStep(s=>s+1)}>Próxima →</Btn>
          : <Btn onClick={()=>onSave(form)} disabled={!form.termo_aceito||!form.assinatura_base64}><I.Check s={12}/> Salvar Anamnese</Btn>
        }
      </div>
    </Mod>
  );
}


/* ─── AUTH MODALS ────────────────────────────────────────────── */
function LoginModal({onClose, onLogin, onGoSignup}) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [shake, setShake] = useState(false);
  const [modo, setModo] = useState("login"); // 'login' | 'recuperar'
  const [recEnviado, setRecEnviado] = useState(false);

  const doRecuperar = async () => {
    if (!email) { setErro("Informe seu e-mail."); return; }
    setLoading(true); setErro("");
    if (DEMO_MODE) {
      await new Promise(r => setTimeout(r, 600));
      setLoading(false); setRecEnviado(true); return;
    }
    const res = await sb.recover(email);
    setLoading(false);
    if (res.erro) { setErro(res.erro); return; }
    setRecEnviado(true);
  };

  const doLogin = async () => {
    if (!email || !senha) { setErro("Preencha e-mail e senha."); return; }
    setLoading(true); setErro("");

    /* ── Modo demo ── */
    if (DEMO_MODE) {
      await new Promise(r => setTimeout(r, 800));
      const u = DEMO_USERS.find(u => u.email === email && u.senha === senha);
      if (u) { onLogin(u); return; }
      setErro("Credenciais incorretas.");
      setLoading(false); setShake(true); setTimeout(() => setShake(false), 400);
      return;
    }

    /* ── Modo real — Supabase Auth ── */
    const auth = await sb.login(email, senha);
    if (auth.erro) {
      setErro(auth.erro);
      setLoading(false); setShake(true); setTimeout(() => setShake(false), 400);
      return;
    }

    /* Verifica primeiro se é o dono do sistema (super admin) */
    try {
      const superCheck = await sb.get("super_admins", `email=eq.${encodeURIComponent(auth.email||email)}`);
      if (superCheck?.[0]) {
        onLogin({ isSuperAdmin:true, email: auth.email||email, nome: superCheck[0].nome||"Administrador", token: auth.token });
        return;
      }
    } catch(e) { /* tabela pode não existir ainda em instalações antigas — segue fluxo normal */ }

    /* Verifica se é uma afiliada */
    try {
      const afiliadoCheck = await sb.get("afiliados", `auth_user_id=eq.${auth.userId}`);
      if (afiliadoCheck?.[0]) {
        const af = afiliadoCheck[0];
        if (af.status === "descredenciado") {
          setErro("Seu acesso ao Programa de Afiliados foi encerrado. Entre em contato com o suporte.");
          setLoading(false);
          return;
        }
        onLogin({ isAfiliado:true, afiliadoId:af.id, email:auth.email||email, nome:af.nome_completo, codigo:af.codigo_afiliado, token:auth.token });
        return;
      }
    } catch(e) { /* segue fluxo normal se a tabela não existir */ }

    /* Busca o vínculo do usuário autenticado com a clínica e seu papel (role) */
    const vinculos = await sb.get("usuarios_clinica", `auth_user_id=eq.${auth.userId}&ativo=eq.true`);
    const vinculo = vinculos?.[0];

    if (!vinculo) {
      setErro("Usuário autenticado mas sem vínculo com nenhuma clínica. Contate o suporte.");
      setLoading(false);
      return;
    }

    const perfis = await sb.get("clinicas", `id=eq.${vinculo.clinica_id}`);
    const perfil = perfis?.[0];

    /* Bloqueio por inadimplência — impede o acesso mesmo com senha correta */
    if (perfil?.bloqueada) {
      setErro(`Acesso bloqueado.${perfil.motivo_bloqueio ? " " + perfil.motivo_bloqueio : " Entre em contato com o suporte."}`);
      setLoading(false);
      return;
    }

    onLogin({
      id: vinculo.clinica_id,      /* clinica_id real — usado em todas as queries de dados */
      authUserId: auth.userId,
      email: auth.email || email,
      nome: vinculo.nome,
      role: vinculo.role,           /* 'supervisor' ou 'profissional' */
      profissionalId: vinculo.profissional_id,
      clinica: perfil?.nome || email,
      plano: perfil?.plano || "mensal",
      contratoVencimento: perfil?.contrato_vencimento,
      acessoVitalicio: perfil?.acesso_vitalicio,
      token: auth.token,
    });
  };

  return (
    <div style={{position:"fixed",inset:0,background:"#4A3D6280",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(8px)"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="fu" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:20,width:"100%",maxWidth:380,overflow:"hidden"}}>

        <div style={{background:"linear-gradient(135deg,#7C5CBF08,transparent)",padding:"28px 24px 18px",borderBottom:`1px solid ${T.border}`,textAlign:"center"}}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:12}}>
            <Logo size={160}/>
          </div>
          <div style={{color:T.mutedLt,fontSize:12,marginTop:2}}>Entre com sua conta</div>
        </div>

        <div className={shake?"sk":""} style={{padding:"18px 24px"}}>
          {erro && (
            <div className="fi" style={{background:"#FF5A5A14",border:"1px solid #FF5A5A30",borderRadius:9,padding:"9px 12px",marginBottom:12,display:"flex",gap:7,alignItems:"flex-start"}}>
              <I.Warn c={T.danger} s={14}/>
              <span style={{color:T.danger,fontSize:11,lineHeight:1.5,whiteSpace:"pre-line"}}>{erro}</span>
            </div>
          )}

          {modo==="login" ? <>
          <div style={{marginBottom:12}}>
            <label style={{display:"block",color:T.mutedLt,fontSize:10,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>E-mail</label>
            <input type="email" placeholder="seu@email.com" value={email}
              onChange={e=>setEmail(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&doLogin()}
              style={{width:"100%",background:T.surface,border:`1px solid ${T.border}`,borderRadius:9,padding:"10px 12px",color:T.text,fontSize:14}}/>
          </div>

          <div style={{marginBottom:10}}>
            <label style={{display:"block",color:T.mutedLt,fontSize:10,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Senha</label>
            <div style={{position:"relative"}}>
              <input type={show?"text":"password"} placeholder="••••••••" value={senha}
                onChange={e=>setSenha(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&doLogin()}
                style={{width:"100%",background:T.surface,border:`1px solid ${T.border}`,borderRadius:9,padding:"10px 40px 10px 12px",color:T.text,fontSize:14}}/>
              <button onClick={()=>setShow(!show)} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:T.muted,cursor:"pointer"}}>
                {show ? <I.EyeOff c={T.muted} s={14}/> : <I.Eye c={T.muted} s={14}/>}
              </button>
            </div>
          </div>

          <div style={{textAlign:"right",marginBottom:18}}>
            <button onClick={()=>{setModo("recuperar");setErro("");setRecEnviado(false);}} style={{background:"none",border:"none",color:T.muted,fontSize:11,cursor:"pointer"}}>Esqueci minha senha</button>
          </div>

          <button className="gb gl" onClick={doLogin} disabled={loading}
            style={{width:"100%",background:T.gold,color:"#FFFFFF",border:"none",borderRadius:10,padding:"12px",fontWeight:700,fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",gap:8,cursor:"pointer"}}>
            {loading ? <><Spin c="#FFFFFF"/>Verificando...</> : "Entrar no sistema →"}
          </button>

          <div style={{textAlign:"center",marginTop:14}}>
            <span style={{color:T.muted,fontSize:12}}>Não tem conta? </span>
            <button onClick={onGoSignup} style={{background:"none",border:"none",color:T.gold,fontSize:12,fontWeight:600,cursor:"pointer"}}>Assinar agora</button>
          </div>
          </> : (
          recEnviado ? <>
            <div style={{textAlign:"center",padding:"10px 0 4px"}}>
              <div style={{width:48,height:48,borderRadius:"50%",background:`${T.success}18`,border:`1.5px solid ${T.success}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}><I.Check c={T.success} s={22}/></div>
              <div style={{color:T.text,fontSize:13,lineHeight:1.6,marginBottom:16}}>Se houver uma conta cadastrada com o e-mail <strong>{email}</strong>, enviamos um link para redefinir sua senha.</div>
              <button onClick={()=>{setModo("login");setRecEnviado(false);}} style={{background:"none",border:"none",color:T.gold,fontSize:12,fontWeight:600,cursor:"pointer"}}>← Voltar para o login</button>
            </div>
          </> : <>
            <p style={{color:T.mutedLt,fontSize:12,lineHeight:1.5,marginBottom:14}}>Informe o e-mail da sua conta. Vamos enviar um link para você criar uma nova senha.</p>
            <div style={{marginBottom:18}}>
              <label style={{display:"block",color:T.mutedLt,fontSize:10,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>E-mail</label>
              <input type="email" placeholder="seu@email.com" value={email}
                onChange={e=>setEmail(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&doRecuperar()}
                style={{width:"100%",background:T.surface,border:`1px solid ${T.border}`,borderRadius:9,padding:"10px 12px",color:T.text,fontSize:14}}/>
            </div>
            <button className="gb gl" onClick={doRecuperar} disabled={loading}
              style={{width:"100%",background:T.gold,color:"#FFFFFF",border:"none",borderRadius:10,padding:"12px",fontWeight:700,fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",gap:8,cursor:"pointer"}}>
              {loading ? <><Spin c="#FFFFFF"/>Enviando...</> : "Enviar link de recuperação"}
            </button>
            <div style={{textAlign:"center",marginTop:14}}>
              <button onClick={()=>{setModo("login");setErro("");}} style={{background:"none",border:"none",color:T.muted,fontSize:12,cursor:"pointer"}}>← Voltar para o login</button>
            </div>
          </>
          )}
        </div>

        <div style={{padding:"0 24px 16px",textAlign:"center"}}>
          <button onClick={onClose} style={{background:"none",border:"none",color:T.muted,fontSize:12,cursor:"pointer"}}>← Voltar</button>
        </div>
      </div>
    </div>
  );
}

/* Tela exibida quando o usuário volta do e-mail de recuperação de senha
   (URL contém #access_token=...&type=recovery, enviado pelo Supabase Auth). */
function ResetPasswordModal({accessToken, onDone}) {
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState(false);

  const salvar = async () => {
    if (senha.length < 6) { setErro("A senha deve ter pelo menos 6 caracteres."); return; }
    if (senha !== confirmar) { setErro("As senhas não coincidem."); return; }
    setLoading(true); setErro("");
    const res = await sb.updatePassword(senha, accessToken);
    setLoading(false);
    if (res.erro) { setErro(res.erro); return; }
    setOk(true);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"#4A3D6280",zIndex:2100,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(8px)"}}>
      <div className="fu" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:20,width:"100%",maxWidth:380,overflow:"hidden"}}>
        <div style={{background:"linear-gradient(135deg,#7C5CBF08,transparent)",padding:"28px 24px 18px",borderBottom:`1px solid ${T.border}`,textAlign:"center"}}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:12}}><Logo size={160}/></div>
          <div style={{color:T.mutedLt,fontSize:12,marginTop:2}}>Criar nova senha</div>
        </div>
        <div style={{padding:"18px 24px"}}>
          {ok ? <>
            <div style={{textAlign:"center",padding:"10px 0 4px"}}>
              <div style={{width:48,height:48,borderRadius:"50%",background:`${T.success}18`,border:`1.5px solid ${T.success}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}><I.Check c={T.success} s={22}/></div>
              <div style={{color:T.text,fontSize:13,lineHeight:1.6,marginBottom:16}}>Senha redefinida com sucesso. Você já pode entrar com sua nova senha.</div>
              <button className="gb gl" onClick={onDone} style={{width:"100%",background:T.gold,color:"#FFFFFF",border:"none",borderRadius:10,padding:"12px",fontWeight:700,fontSize:14}}>Ir para o login →</button>
            </div>
          </> : <>
            {erro && (
              <div className="fi" style={{background:"#FF5A5A14",border:"1px solid #FF5A5A30",borderRadius:9,padding:"9px 12px",marginBottom:12,display:"flex",gap:7,alignItems:"flex-start"}}>
                <I.Warn c={T.danger} s={14}/>
                <span style={{color:T.danger,fontSize:11,lineHeight:1.5,whiteSpace:"pre-line"}}>{erro}</span>
              </div>
            )}
            <div style={{marginBottom:12}}>
              <label style={{display:"block",color:T.mutedLt,fontSize:10,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Nova senha</label>
              <input type="password" placeholder="Mín. 6 caracteres" value={senha} onChange={e=>setSenha(e.target.value)}
                style={{width:"100%",background:T.surface,border:`1px solid ${T.border}`,borderRadius:9,padding:"10px 12px",color:T.text,fontSize:14}}/>
            </div>
            <div style={{marginBottom:18}}>
              <label style={{display:"block",color:T.mutedLt,fontSize:10,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Confirmar nova senha</label>
              <input type="password" placeholder="Repita a senha" value={confirmar} onChange={e=>setConfirmar(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&salvar()}
                style={{width:"100%",background:T.surface,border:`1px solid ${T.border}`,borderRadius:9,padding:"10px 12px",color:T.text,fontSize:14}}/>
            </div>
            <button className="gb gl" onClick={salvar} disabled={loading}
              style={{width:"100%",background:T.gold,color:"#FFFFFF",border:"none",borderRadius:10,padding:"12px",fontWeight:700,fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",gap:8,cursor:"pointer"}}>
              {loading ? <><Spin c="#FFFFFF"/>Salvando...</> : "Salvar nova senha"}
            </button>
          </>}
        </div>
      </div>
    </div>
  );
}

/* Campo de formulário do Checkout — componente independente (fora do
   CheckoutModal) para não perder o foco a cada tecla digitada.        */
const LF = ({label,k,ph,mask,type="text",half,form,errs,onChange,showS,setShowS}) => (
  <div style={{flex:half?"1 1 45%":"1 1 100%",minWidth:half?100:"auto"}}>
    <label style={{display:"block",color:T.mutedLt,fontSize:10,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>{label}</label>
    <div style={{position:"relative"}}>
      <input type={k==="senha"&&!showS?"password":type} placeholder={ph} value={form[k]} onChange={e=>onChange(k,mask?mask(e.target.value):e.target.value)} style={{width:"100%",background:T.surface,border:`1px solid ${errs[k]?T.danger:T.border}`,borderRadius:8,padding:k==="senha"?"10px 38px 10px 12px":"10px 12px",color:T.text,fontSize:13}}/>
      {k==="senha"&&<button type="button" onClick={()=>setShowS(!showS)} style={{position:"absolute",right:9,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:T.muted}}>{showS?<I.EyeOff c={T.muted} s={13}/>:<I.Eye c={T.muted} s={13}/>}</button>}
    </div>
    {errs[k]&&<span style={{color:T.danger,fontSize:10,marginTop:2,display:"block"}}>{errs[k]}</span>}
  </div>
);

/* Termos de Uso e Política de Privacidade — VirtualPlan Consultoria em TI, CNPJ 46.516.875/0001-41.
   ATENÇÃO: texto-base para revisão jurídica antes da publicação. Como o sistema trata
   dados de saúde de pacientes (art. 5º, II da LGPD), recomenda-se validação por um
   advogado antes de ir ao ar. */
const TEXTO_TERMOS_VPBEAUTY = `TERMOS DE USO E POLÍTICA DE PRIVACIDADE — VPBEAUTY

Última atualização: 23 de agosto de 2026

1. QUEM SOMOS
A plataforma VPBeauty é operada por VirtualPlan Consultoria em TI, inscrita no CNPJ sob o nº 46.516.875/0001-41, com sede na Avenida São Sebastião, 1353 - sala 201, Cuiabá/MT, CEP 78032-160 ("VPBeauty").

2. OBJETO
O VPBeauty é um sistema de gestão para clínicas de estética (agenda, prontuário, financeiro, estoque e módulos correlatos), oferecido por assinatura mensal ou anual conforme o plano contratado no ato da adesão.

3. ASSINATURA, COBRANÇA E CANCELAMENTO
3.1. O plano contratado é cobrado de forma recorrente (mensal ou anual), com renovação automática ao final de cada período, salvo cancelamento solicitado pelo(a) CONTRATANTE antes da data de renovação.
3.2. O acesso ao sistema pode ser suspenso em caso de inadimplência, mediante aviso prévio.
3.3. O cancelamento pode ser solicitado a qualquer momento pelos canais de suporte oficiais, sem multa, produzindo efeitos ao final do período já pago.

4. DADOS PESSOAIS E DE SAÚDE — LGPD
4.1. O(A) CONTRATANTE (clínica) é o(a) Controlador(a) dos dados pessoais e dados sensíveis de saúde de seus pacientes inseridos no sistema, sendo responsável por obter o consentimento e a base legal adequada junto a cada paciente, nos termos da Lei nº 13.709/2018 (LGPD).
4.2. O VPBeauty atua como Operador(a) desses dados, processando-os exclusivamente para viabilizar as funcionalidades do sistema contratado, com medidas técnicas e administrativas de segurança da informação.
4.3. Dados cadastrais da própria clínica e de seus usuários (nome, e-mail, telefone) são utilizados para prestação do serviço, faturamento, suporte e comunicações sobre a conta.
4.4. O(A) CONTRATANTE pode solicitar a exportação ou exclusão de seus dados a qualquer momento, observadas obrigações legais de guarda de documentos fiscais e contábeis.

5. RESPONSABILIDADES DO(A) CONTRATANTE
5.1. Manter a confidencialidade de suas credenciais de acesso.
5.2. Garantir a veracidade e a licitude dos dados inseridos no sistema, inclusive dados de pacientes.
5.3. Utilizar o sistema em conformidade com a legislação aplicável à sua atividade (vigilância sanitária, conselhos de classe, proteção ao consumidor, entre outras).

6. DISPONIBILIDADE E SUPORTE
O VPBeauty envida seus melhores esforços para manter o serviço disponível de forma contínua, podendo realizar manutenções programadas com aviso prévio quando possível. O suporte é prestado pelos canais indicados na plataforma.

7. LIMITAÇÃO DE RESPONSABILIDADE
Nos limites da lei, o VPBeauty não se responsabiliza por decisões clínicas, comerciais ou financeiras tomadas pelo(a) CONTRATANTE com base nas informações do sistema, tampouco por indisponibilidades decorrentes de fatores fora de seu controle razoável.

8. ALTERAÇÕES
Estes Termos podem ser atualizados periodicamente. Alterações relevantes serão comunicadas ao(à) CONTRATANTE, sendo a permanência no uso do sistema após a comunicação interpretada como aceite às novas condições.

9. FORO
Fica eleito o foro da comarca de Cuiabá/MT para dirimir eventuais controvérsias decorrentes destes Termos, com renúncia a qualquer outro, por mais privilegiado que seja.

Ao marcar "Li e concordo", o(a) CONTRATANTE declara ter lido e aceito integralmente estes Termos de Uso e Política de Privacidade.`;

function CheckoutModal({plan,onClose,onSuccess,desconto=0,codigoAfiliado=""}) {
  const [step,setStep]=useState(1);const [form,setForm]=useState({clinica:"",nome:"",email:"",telefone:"",senha:"",cpfCnpj:"",cep:"",numeroEndereco:"",cartao:"",validade:"",cvv:"",titular:""});const [errs,setErrs]=useState({});const [loading,setLoading]=useState(false);const [showS,setShowS]=useState(false);
  const [aceiteTermos,setAceiteTermos]=useState(false);
  const [showTermos,setShowTermos]=useState(false);
  const anual=plan==="anual";
  const precoBase = anual?3990:399;
  const precoFinal = desconto>0 ? precoBase*(1-desconto/100) : precoBase;
  const preco = precoFinal.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
  const f=(k,v)=>setForm(p=>({...p,[k]:v}));
  const validate=()=>{const e={};if(step===1){if(!form.clinica.trim())e.clinica="Obrigatório";if(!form.nome.trim())e.nome="Obrigatório";if(!form.email.includes("@"))e.email="Inválido";if(form.telefone.replace(/\D/g,"").length<10)e.telefone="Inválido";if(form.senha.length<6)e.senha="Mín. 6 caracteres";if(form.cpfCnpj.replace(/\D/g,"").length<11)e.cpfCnpj="CPF ou CNPJ inválido";}if(step===2){if(form.cartao.replace(/\s/g,"").length<16)e.cartao="Inválido";if(!form.validade.includes("/"))e.validade="MM/AA";if(form.cvv.length<3)e.cvv="Inválido";if(!form.titular.trim())e.titular="Obrigatório";if(form.cep.replace(/\D/g,"").length<8)e.cep="CEP inválido";if(!form.numeroEndereco.trim())e.numeroEndereco="Obrigatório";if(!aceiteTermos)e.termos="É preciso aceitar os Termos de Uso e a Política de Privacidade para continuar.";}setErrs(e);return Object.keys(e).length===0;};
  const next = async () => {
    if (!validate()) return;
    if (step === 1) { setStep(2); return; }
    setLoading(true);
    if (DEMO_MODE) {
      await new Promise(r => setTimeout(r, 1500));
      DEMO_USERS.push({id:"demo-"+Date.now(),email:form.email,senha:form.senha,clinica:form.clinica,plano:plan,role:"supervisor",nome:form.nome,profissionalId:null});
      setLoading(false); setStep(3); return;
    }
    const res = await sb.checkout({
      clinica: form.clinica, nome: form.nome, email: form.email, telefone: form.telefone, senha: form.senha,
      cpfCnpj: form.cpfCnpj, cep: form.cep, numeroEndereco: form.numeroEndereco, plano: plan,
      cartao: { numero: form.cartao, validade: form.validade, cvv: form.cvv, titular: form.titular },
      codigoAfiliado,
    });
    setLoading(false);
    if (res.erro) { setErrs({cartao: res.erro}); return; }
    setStep(3);
  };
  const [entrandoNoSistema, setEntrandoNoSistema] = useState(false);
  const acessarSistema = async () => {
    if (DEMO_MODE) { onSuccess({email:form.email,senha:form.senha,clinica:form.clinica,plano:plan}); return; }
    setEntrandoNoSistema(true);
    const auth = await sb.login(form.email, form.senha);
    if (auth.erro) { setErrs({cartao:"Assinatura ativada, mas não foi possível entrar automaticamente. Feche esta janela e faça login."}); setEntrandoNoSistema(false); return; }
    const vinculos = await sb.get("usuarios_clinica", `auth_user_id=eq.${auth.userId}&ativo=eq.true`);
    const vinculo = vinculos?.[0];
    const perfis = vinculo ? await sb.get("clinicas", `id=eq.${vinculo.clinica_id}`) : null;
    const perfil = perfis?.[0];
    setEntrandoNoSistema(false);
    onSuccess({
      id: vinculo?.clinica_id, authUserId: auth.userId, email: auth.email||form.email,
      nome: vinculo?.nome||form.nome, role: vinculo?.role||"supervisor", profissionalId: vinculo?.profissional_id,
      clinica: perfil?.nome||form.clinica, plano: perfil?.plano||plan,
      contratoVencimento: perfil?.contrato_vencimento, acessoVitalicio: perfil?.acesso_vitalicio,
      token: auth.token,
    });
  };
  const mCard=v=>v.replace(/\D/g,"").slice(0,16).replace(/(.{4})/g,"$1 ").trim();const mVal=v=>v.replace(/\D/g,"").slice(0,4).replace(/(\d{2})(\d)/,"$1/$2");
  return(
    <div style={{position:"fixed",inset:0,background:"#4A3D6280",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(8px)"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="fu" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:20,width:"100%",maxWidth:480,maxHeight:"92vh",overflowY:"auto"}}>
        <div style={{padding:"16px 21px 12px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div className="cm" style={{fontSize:18,fontWeight:600,color:T.text}}>VP<span style={{color:T.gold}}>Beauty</span></div><div style={{color:T.gold,fontSize:11,marginTop:1}}>Plano {anual?"Anual":"Mensal"} — R$ {preco}/{anual?"ano":"mês"} {desconto>0&&<span style={{color:T.success,fontWeight:700}}>({desconto}% off renovação)</span>}</div></div>
          <button onClick={onClose} style={{background:"none",border:"none",color:T.muted}}><I.X c={T.muted} s={17}/></button>
        </div>
        <div style={{display:"flex",alignItems:"center",padding:"11px 21px",borderBottom:`1px solid ${T.border}`}}>
          {[["1","Dados"],["2","Pagamento"],["3","Ativado!"]].map(([n,label],i)=>(
            <div key={n} style={{display:"flex",alignItems:"center",flex:i<2?1:"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:22,height:22,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,background:step>i?T.gold:step===i+1?`${T.gold}25`:T.surface,color:step>i?"#FFFFFF":step===i+1?T.gold:T.muted,border:`1px solid ${step>=i+1?T.gold:T.border}`}}>{step>i?<I.Check c="#FFFFFF" s={11}/>:n}</div>
                <span style={{color:step===i+1?T.gold:T.muted,fontSize:10,fontWeight:step===i+1?600:400}}>{label}</span>
              </div>{i<2&&<div style={{flex:1,height:1,background:step>i+1?T.gold:T.border,margin:"0 7px"}}/>}
            </div>
          ))}
        </div>
        <div style={{padding:"16px 21px"}}>
          {step===1&&<div className="fu"><div style={{display:"flex",flexWrap:"wrap",gap:10}}><LF label="Nome da Clínica" k="clinica" ph="Ex: Studio Lumière" form={form} errs={errs} onChange={f}/><LF label="Seu nome" k="nome" ph="Responsável" form={form} errs={errs} onChange={f}/><LF label="E-mail" k="email" ph="seu@email.com" type="email" form={form} errs={errs} onChange={f}/><LF label="WhatsApp" k="telefone" ph="(11) 99999-9999" mask={maskFone} form={form} errs={errs} onChange={f}/><LF label="CPF ou CNPJ" k="cpfCnpj" ph="Para emissão da cobrança" mask={maskCpfCnpj} form={form} errs={errs} onChange={f}/><LF label="Senha de acesso" k="senha" ph="Mín. 6 caracteres" form={form} errs={errs} onChange={f} showS={showS} setShowS={setShowS}/></div></div>}
          {step===2&&<div className="fu">
            <div style={{background:`${T.gold}10`,border:`1px solid ${T.gold}28`,borderRadius:9,padding:"10px 12px",marginBottom:13,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{color:T.text,fontWeight:600,fontSize:12}}>Plano {anual?"Anual":"Mensal"}</div>{anual&&<div style={{color:T.success,fontSize:10,marginTop:1}}>Economize R$ 798 vs. mensal</div>}</div>
              <div style={{color:T.gold,fontWeight:700,fontSize:16}}>R$ {preco}</div>
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:10}}><LF label="Número do cartão" k="cartao" ph="0000 0000 0000 0000" mask={mCard} form={form} errs={errs} onChange={f}/><LF label="Nome no cartão" k="titular" ph="Como aparece no cartão" form={form} errs={errs} onChange={f}/><LF label="Validade" k="validade" ph="MM/AA" mask={mVal} half form={form} errs={errs} onChange={f}/><LF label="CVV" k="cvv" ph="123" half form={form} errs={errs} onChange={f}/><LF label="CEP de cobrança" k="cep" ph="00000-000" mask={maskCEP} half form={form} errs={errs} onChange={f}/><LF label="Número do endereço" k="numeroEndereco" ph="Ex: 100" half form={form} errs={errs} onChange={f}/></div>
            <div style={{display:"flex",alignItems:"center",gap:7,marginTop:9}}><I.Lock c={T.success} s={12}/><span style={{color:T.success,fontSize:11}}>SSL 256-bit — pagamento seguro</span></div>
            <label style={{display:"flex",alignItems:"flex-start",gap:8,marginTop:14,cursor:"pointer"}}>
              <input type="checkbox" checked={aceiteTermos} onChange={e=>setAceiteTermos(e.target.checked)} style={{marginTop:2,cursor:"pointer"}}/>
              <span style={{color:T.mutedLt,fontSize:11,lineHeight:1.5}}>Li e concordo com os <button type="button" onClick={()=>setShowTermos(true)} style={{background:"none",border:"none",padding:0,color:T.gold,fontSize:11,fontWeight:600,cursor:"pointer",textDecoration:"underline"}}>Termos de Uso e a Política de Privacidade</button> do VPBeauty.</span>
            </label>
            {errs.termos&&<span style={{color:T.danger,fontSize:10,marginTop:4,display:"block"}}>{errs.termos}</span>}
          </div>}
          {step===3&&<div className="fu" style={{textAlign:"center",padding:"10px 0"}}>
            <div style={{width:58,height:58,borderRadius:"50%",background:`${T.success}18`,border:`1.5px solid ${T.success}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}><I.Check c={T.success} s={26}/></div>
            <div className="cm" style={{fontSize:22,fontWeight:600,color:T.text,marginBottom:6}}>Bem-vinda, {form.clinica}!</div>
            <div style={{background:T.surface,borderRadius:10,padding:12,textAlign:"left",marginBottom:16}}>
              {[`Login: ${form.email}`,"5 usuários incluídos","Todos os módulos ativos","Suporte WhatsApp"].map(t=><div key={t} style={{display:"flex",alignItems:"center",gap:7,marginBottom:6}}><I.Check c={T.success} s={12}/><span style={{color:T.text,fontSize:12}}>{t}</span></div>)}
            </div>
            <button className="gb gl" onClick={acessarSistema} disabled={entrandoNoSistema} style={{width:"100%",background:T.gold,color:"#FFFFFF",border:"none",borderRadius:10,padding:"12px",fontWeight:700,fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>{entrandoNoSistema?<><Spin c="#FFFFFF"/>Entrando...</>:"Acessar o Sistema →"}</button>
            {errs.cartao&&<div style={{background:T.danger+"14",border:`1px solid ${T.danger}30`,borderRadius:8,padding:"9px 12px",marginTop:10,color:T.danger,fontSize:12}}>{errs.cartao}</div>}
          </div>}
        </div>
        {step<3&&<div style={{padding:"0 21px 16px"}}>
          <button className="gb gl" onClick={next} disabled={loading} style={{width:"100%",background:T.gold,color:"#FFFFFF",border:"none",borderRadius:10,padding:"12px",fontWeight:700,fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            {loading?<><Spin c="#FFFFFF"/>Processando...</>:step===1?"Continuar →":"Ativar assinatura →"}
          </button>
          <p style={{color:T.muted,fontSize:10,textAlign:"center",marginTop:7}}>{anual?"Cobrança anual":"Cancele a qualquer momento"}</p>
        </div>}
      </div>
      {showTermos && (
        <div style={{position:"fixed",inset:0,background:"#4A3D6280",zIndex:2200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={e=>e.target===e.currentTarget&&setShowTermos(false)}>
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,width:"100%",maxWidth:560,maxHeight:"85vh",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"16px 21px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div className="cm" style={{fontSize:15,fontWeight:600,color:T.text}}>Termos de Uso e Política de Privacidade</div>
              <button onClick={()=>setShowTermos(false)} style={{background:"none",border:"none",color:T.muted}}><I.X c={T.muted} s={17}/></button>
            </div>
            <div style={{padding:"14px 21px",overflowY:"auto"}}>
              <pre style={{color:T.mutedLt,fontSize:11,lineHeight:1.7,whiteSpace:"pre-wrap",fontFamily:"inherit",margin:0}}>{TEXTO_TERMOS_VPBEAUTY}</pre>
            </div>
            <div style={{padding:"12px 21px",borderTop:`1px solid ${T.border}`}}>
              <button className="gb gl" onClick={()=>{setAceiteTermos(true);setShowTermos(false);}} style={{width:"100%",background:T.gold,color:"#FFFFFF",border:"none",borderRadius:9,padding:"11px",fontWeight:700,fontSize:13,cursor:"pointer"}}>Li e concordo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   MÓDULOS DO SISTEMA
   ═══════════════════════════════════════════════════════════════ */

/* ─── DASHBOARD ──────────────────────────────────────────────── */
function Dashboard({data, user}) {
  const [diag, setDiag] = useState(null);
  const [diagLoading, setDiagLoading] = useState(false);

  const testarConexao = async () => {
    setDiagLoading(true);
    const resultado = { url: SUPABASE_URL, demo: DEMO_MODE, userId: user?.id, testes: [] };
    try {
      // Teste 1: Autenticação
      const r1 = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: getHeaders() });
      resultado.testes.push({ nome: "Autenticação (token)", ok: r1.ok, status: r1.status, msg: r1.ok ? "Token válido ✓" : `Falhou (${r1.status}) — refaça o login` });

      // Teste 2: Leitura de clinicas
      const r2 = await fetch(`${SUPABASE_URL}/rest/v1/clinicas?limit=5`, { headers: getHeaders() });
      const d2 = await r2.json();
      resultado.testes.push({ nome: "Leitura — tabela clinicas", ok: r2.ok && !d2.message, status: r2.status, msg: r2.ok && !d2.message ? `OK — ${d2.length} registro(s)` : (d2.message || d2.hint || `Erro ${r2.status}`) });

      // Teste 3: Leitura de pacientes
      const r3 = await fetch(`${SUPABASE_URL}/rest/v1/pacientes?limit=5`, { headers: getHeaders() });
      const d3 = await r3.json();
      resultado.testes.push({ nome: "Leitura — tabela pacientes", ok: r3.ok && !d3.message, status: r3.status, msg: r3.ok && !d3.message ? `OK — ${d3.length} registro(s)` : (d3.message || d3.hint || `Erro ${r3.status} — verifique RLS`) });

      // Teste 4: Inserção de teste
      const r4 = await fetch(`${SUPABASE_URL}/rest/v1/clinicas?email=eq.teste_diagnostico@sistema.com`, { headers: getHeaders() });
      resultado.testes.push({ nome: "Permissão de escrita", ok: r4.ok, status: r4.status, msg: r4.ok ? "Permissão OK ✓" : `Sem permissão de escrita (${r4.status})` });

    } catch (e) {
      resultado.testes.push({ nome: "Conexão de rede", ok: false, status: 0, msg: `Erro: ${e.message}` });
    }
    setDiag(resultado);
    setDiagLoading(false);
  };
  const [filt,setFilt]=useState({de:"",ate:"",profissional:""});
  const ff=(k,v)=>setFilt(p=>({...p,[k]:v}));

  const atFiltrados = useMemo(()=>{
    let list=[...data.atendimentos];
    if(filt.de) list=list.filter(a=>a.data>=filt.de);
    if(filt.ate) list=list.filter(a=>a.data<=filt.ate);
    if(filt.profissional) list=list.filter(a=>String(a.profissional_id)===filt.profissional);
    return list;
  },[data.atendimentos,filt]);

  const rec=atFiltrados.reduce((s,a)=>s+(Number(a.valor_final||a.valor)||0),0);
  const despFiltradas=(data.contas_pagar||[]).filter(c=>c.status!=="cancelado"&&(!filt.de||c.vencimento>=filt.de)&&(!filt.ate||c.vencimento<=filt.ate));
  const tf=despFiltradas.filter(c=>c.recorrente).reduce((s,d)=>s+(Number(d.valor)||0),0);
  const tv=despFiltradas.filter(c=>!c.recorrente).reduce((s,d)=>s+(Number(d.valor)||0),0);
  const lucro=rec-tf-tv;
  const hoje=data.agendamentos.filter(a=>a.data===today());
  const baixo=data.produtos.filter(e=>e.estoque_atual<=e.estoque_minimo);

  // Saldo contas
  const saldoCaixa=(data.contas_bancarias||[]).reduce((s,c)=>{
    const movs=(data.movimentacoes||[]).filter(m=>m.conta_id===c.id);
    const saldo=movs.reduce((acc,m)=>m.tipo==="entrada"?acc+Number(m.valor):acc-Number(m.valor),Number(c.saldo_inicial)||0);
    return s+saldo;
  },0);

  return (
    <div>
      <div style={{marginBottom:12}}>
        <h2 style={{color:C.text,fontSize:17,fontWeight:700,marginBottom:2}}>Dashboard</h2>
        <p style={{color:C.muted,fontSize:12}}>VPBeauty</p>
      </div>

      {/* Banner modo demo */}
      {DEMO_MODE&&<div style={{background:`${T.gold}12`,border:`1px solid ${T.gold}35`,borderRadius:10,padding:"9px 13px",marginBottom:13,display:"flex",alignItems:"center",gap:8}}>
        <I.Diamond c={T.gold} s={14}/>
        <span style={{color:T.gold,fontSize:11,fontWeight:600}}>Modo Demonstração — dados simulados. Configure SUPABASE_URL e SUPABASE_KEY no topo do App.js para usar dados reais.</span>
      </div>}

      {/* Painel de diagnóstico — aparece apenas no modo real */}
      {!DEMO_MODE&&<div style={{marginBottom:14}}>
        {!diag&&<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
          <span style={{color:C.muted,fontSize:12}}>Clique em "Testar Conexão" se os dados não estiverem aparecendo</span>
          <Btn v="i" onClick={testarConexao} disabled={diagLoading} style={{whiteSpace:"nowrap"}}>
            {diagLoading?<><Spin s={12} c={C.info}/>Testando...</>:<><I.Refresh s={12}/> Testar Conexão</>}
          </Btn>
        </div>}
        {diag&&<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",marginBottom:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <span style={{color:C.text,fontSize:12,fontWeight:700}}>Diagnóstico de Conexão</span>
            <div style={{display:"flex",gap:7}}>
              <Btn v="g" onClick={testarConexao} style={{fontSize:10,padding:"3px 9px"}}><I.Refresh s={11}/> Retestar</Btn>
              <Btn v="g" onClick={()=>setDiag(null)} style={{fontSize:10,padding:"3px 9px"}}><I.X s={11}/> Fechar</Btn>
            </div>
          </div>
          <div style={{marginBottom:8,fontSize:11,color:C.muted}}>
            URL: <code style={{color:C.text,fontSize:10}}>{diag.url}</code> · ID: <code style={{color:C.text,fontSize:10}}>{diag.userId||"não definido"}</code>
          </div>
          {diag.testes.map((t,i)=>(
            <div key={i} style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:6,padding:"7px 10px",background:t.ok?C.success+"10":C.danger+"10",borderRadius:7,border:`1px solid ${t.ok?C.success:C.danger}25`}}>
              <span style={{fontSize:14,flexShrink:0}}>{t.ok?"✅":"❌"}</span>
              <div>
                <div style={{color:C.text,fontSize:11,fontWeight:600}}>{t.nome}</div>
                <div style={{color:t.ok?C.success:C.danger,fontSize:11}}>{t.msg}</div>
              </div>
            </div>
          ))}
          {diag.testes.some(t=>!t.ok)&&<div style={{marginTop:10,background:C.warn+"12",border:`1px solid ${C.warn}30`,borderRadius:8,padding:"9px 12px"}}>
            <div style={{color:C.warn,fontSize:11,fontWeight:700,marginBottom:4}}>O que fazer para corrigir:</div>
            <div style={{color:C.text,fontSize:11,lineHeight:1.7}}>
              1. No Supabase → SQL Editor → execute o arquivo <strong>fix-rls-supabase.sql</strong><br/>
              2. Verifique se SUPABASE_KEY é a chave <strong>anon/public</strong> (começa com eyJ...)<br/>
              3. Faça logout e login novamente para renovar o token<br/>
              4. Verifique se o e-mail do login está cadastrado em <strong>Authentication → Users</strong>
            </div>
          </div>}
        </div>}
      </div>}

      <FilterBar
        filters={[
          {key:"de",type:"date",label:"De"},
          {key:"ate",type:"date",label:"Até"},
          {key:"profissional",type:"select",label:"Profissional",options:data.profissionais.map(p=>({value:String(p.id),label:p.nome}))},
        ]}
        values={filt} onChange={ff}
      />

      <div className="stat-row" style={{display:"flex",gap:9,marginBottom:13,flexWrap:"wrap"}}>
        <SC label="Receita" value={fmt(rec)} Icon={I.Up} color={C.success} sub={`${atFiltrados.length} atend.`}/>
        <SC label="Despesas" value={fmt(tf+tv)} Icon={I.Dollar} color={C.danger}/>
        <SC label="Lucro" value={fmt(lucro)} Icon={I.Sparkle} color={C.accent} sub={`${rec>0?Math.round(lucro/rec*100):0}%`}/>
        <SC label="Saldo Contas" value={fmt(saldoCaixa)} Icon={I.Bank} color={C.info}/>
      </div>

      {baixo.length>0&&<div style={{background:C.warn+"14",border:`1px solid ${C.warn}35`,borderRadius:10,padding:"8px 12px",marginBottom:11,display:"flex",alignItems:"center",gap:8}}>
        <I.Warn c={C.warn} s={14}/><span style={{color:C.warn,fontSize:12,fontWeight:600}}>{baixo.length} produto(s) com estoque crítico: {baixo.map(e=>e.nome).join(", ")}</span>
      </div>}

      <div className="g1" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:13,padding:14}}>
          <h3 style={{color:C.text,fontSize:11,fontWeight:700,marginBottom:11}}>Agenda de Hoje — {hoje.length} consulta(s)</h3>
          {hoje.length===0&&<p style={{color:C.muted,fontSize:12}}>Sem agendamentos para hoje.</p>}
          {hoje.map(ag=>{const p=data.profissionais.find(p=>p.id===ag.profissional_id);return(
            <div key={ag.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:9,paddingBottom:9,borderBottom:`1px solid ${C.border}`}}>
              <div style={{background:(p?.cor||"#888")+"20",borderRadius:6,padding:"4px 7px",fontSize:10,fontWeight:700,color:p?.cor||"#888",minWidth:42,textAlign:"center"}}>{ag.hora}</div>
              <div style={{flex:1}}><div style={{color:C.text,fontSize:11,fontWeight:600}}>{ag.paciente}</div><div style={{color:C.muted,fontSize:10}}>{ag.servico}</div></div>
              <Badge text={ag.status} color={ag.status==="confirmado"?C.success:C.warn}/>
            </div>
          );})}
        </div>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:13,padding:14}}>
          <h3 style={{color:C.text,fontSize:11,fontWeight:700,marginBottom:11}}>Performance de Profissionais</h3>
          {data.profissionais.map(p=>{const ats=atFiltrados.filter(a=>a.profissional_id===p.id);const r=ats.reduce((s,a)=>s+(Number(a.valor_final||a.valor)||0),0);const c=p.tipo==="percentual"?r*(Number(p.percentual)||0)/100:(Number(p.salario)||0);return(
            <div key={p.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:9}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:(p.cor||"#888")+"22",display:"flex",alignItems:"center",justifyContent:"center",color:p.cor||"#888",fontWeight:700,fontSize:10,flexShrink:0}}>{p.nome[0]}</div>
              <div style={{flex:1}}><div style={{color:C.text,fontSize:11,fontWeight:600}}>{p.nome.split(" ").slice(0,2).join(" ")}</div><div style={{background:C.surface,borderRadius:20,height:4,marginTop:3}}><div style={{width:`${Math.min(r/15,100)}%`,height:"100%",background:p.cor||C.accent,borderRadius:20}}/></div></div>
              <div style={{textAlign:"right"}}><div style={{color:C.success,fontSize:10,fontWeight:700}}>{fmt(r)}</div><div style={{color:C.danger,fontSize:9}}>{fmt(c)}</div></div>
            </div>
          );})}
        </div>
      </div>
    </div>
  );
}

/* ─── AGENDAMENTOS ───────────────────────────────────────────── */
function Agendamentos({data,insert,update}) {
  const [modal,setModal]=useState(false);
  const [bloqueioModal,setBloqueioModal]=useState(false);
  const [visao,setVisao]=useState("dia"); // "mes" | "semana" | "dia" | "lista"
  const [diaSelecionado,setDiaSelecionado]=useState(today());
  const [filt,setFilt]=useState({status:"",profissional:"",procedimento:"",de:"",ate:""});
  const ff=(k,v)=>setFilt(p=>({...p,[k]:v}));
  const [form,setForm]=useState({paciente_id:"",paciente:"",procedimento_id:"",servico:"",profissional_id:"",data:today(),hora:"09:00",duracao_minutos:60,status:"aguardando",observacoes:""});
  const [formBloqueio,setFormBloqueio]=useState({profissional_id:"",data_inicio:today(),data_fim:today(),motivo:""});
  const [erroSalvar,setErroSalvar]=useState("");
  const [salvando,setSalvando]=useState(false);

  const lista=useMemo(()=>{
    let l=[...data.agendamentos];
    if(filt.status) l=l.filter(a=>a.status===filt.status);
    if(filt.profissional) l=l.filter(a=>String(a.profissional_id)===filt.profissional);
    if(filt.procedimento) l=l.filter(a=>String(a.procedimento_id)===filt.procedimento);
    if(filt.de) l=l.filter(a=>a.data>=filt.de);
    if(filt.ate) l=l.filter(a=>a.data<=filt.ate);
    return l.sort((a,b)=>a.data.localeCompare(b.data)||a.hora.localeCompare(b.hora));
  },[data.agendamentos,filt]);

  const doDia = useMemo(()=>{
    return data.agendamentos
      .filter(a=>a.data===diaSelecionado)
      .filter(a=>!filt.profissional||String(a.profissional_id)===filt.profissional)
      .sort((a,b)=>a.hora.localeCompare(b.hora));
  },[data.agendamentos,diaSelecionado,filt.profissional]);

  /* Profissionais com a agenda bloqueada no dia selecionado, com nome e motivo */
  const bloqueiosDoDia = useMemo(()=>{
    return (data.bloqueios_agenda||[])
      .filter(b=>diaSelecionado>=b.data_inicio && diaSelecionado<=b.data_fim)
      .filter(b=>!filt.profissional||String(b.profissional_id)===filt.profissional)
      .map(b=>({...b, prof: data.profissionais.find(p=>p.id===b.profissional_id)}));
  },[data.bloqueios_agenda,diaSelecionado,filt.profissional,data.profissionais]);

  /* ── Validação: horário de trabalho + bloqueio + colisão de horário ── */
  const validarAgendamento = (profissionalId, dataISO, hora, duracaoMin, ignorarAgendamentoId) => {
    const diaSemana = new Date(dataISO+"T12:00:00").getDay();
    const horarioDia = (data.horarios_profissional||[]).find(h=>h.profissional_id===profissionalId && h.dia_semana===diaSemana);

    if(!horarioDia || !horarioDia.ativo){
      return "Este profissional não atende neste dia da semana (verifique o horário de trabalho em Cadastros → Profissionais).";
    }
    if(hora < horarioDia.hora_inicio || hora >= horarioDia.hora_fim){
      return `Fora do horário de trabalho. Este profissional atende das ${horarioDia.hora_inicio} às ${horarioDia.hora_fim} neste dia.`;
    }

    const bloqueio = (data.bloqueios_agenda||[]).find(b=>
      b.profissional_id===profissionalId && dataISO>=b.data_inicio && dataISO<=b.data_fim
    );
    if(bloqueio){
      return `Agenda bloqueada neste período${bloqueio.motivo?` — ${bloqueio.motivo}`:""}.`;
    }

    const [h,m]=hora.split(":").map(Number);
    const inicioMin=h*60+m, fimMin=inicioMin+(Number(duracaoMin)||60);
    const conflito = data.agendamentos.find(a=>{
      if(a.id===ignorarAgendamentoId) return false;
      if(a.profissional_id!==profissionalId || a.data!==dataISO || a.status==="cancelado") return false;
      const [ah,am]=a.hora.split(":").map(Number);
      const aIni=ah*60+am, aFim=aIni+(Number(a.duracao_minutos)||60);
      return inicioMin<aFim && fimMin>aIni;
    });
    if(conflito){
      return `Conflito de horário: já existe "${conflito.paciente}" agendado(a) às ${conflito.hora} com este profissional.`;
    }
    return null; // sem erro = válido
  };

  const salvar=async()=>{
    setErroSalvar(""); setSalvando(true);
    const profId = parseInt(form.profissional_id);
    const erroValidacao = validarAgendamento(profId, form.data, form.hora, form.duracao_minutos);
    if(erroValidacao){ setErroSalvar(erroValidacao); setSalvando(false); return; }
    try{
      const proc=data.procedimentos.find(p=>p.id===parseInt(form.procedimento_id));
      await insert("agendamentos",{paciente_id:parseInt(form.paciente_id),paciente:form.paciente,profissional_id:profId,procedimento_id:parseInt(form.procedimento_id),servico:proc?.nome||form.servico,data:form.data,hora:form.hora,duracao_minutos:Number(form.duracao_minutos)||proc?.duracao_minutos||60,status:form.status,observacoes:form.observacoes,valor:proc?.preco_venda||0});
      setModal(false);
    }catch(e){
      setErroSalvar(e.message||"Erro ao salvar o agendamento.");
    }
    setSalvando(false);
  };

  const confirmar=id=>update("agendamentos",id,{status:"confirmado"});
  const cancelar=id=>update("agendamentos",id,{status:"cancelado"});
  const realizar=async ag=>{await insert("atendimentos",{paciente:ag.paciente,paciente_id:ag.paciente_id,procedimento_id:ag.procedimento_id,servico:ag.servico,profissional_id:ag.profissional_id,data:ag.data,valor:ag.valor,valor_final:ag.valor,desconto:0,pago:false,forma_pagamento:"",observacoes:""});await update("agendamentos",ag.id,{status:"realizado"});};
  const sc={confirmado:C.success,aguardando:C.warn,cancelado:C.danger,realizado:C.purple};

  const abrirModal = (horaPreenchida) => {
    setErroSalvar("");
    setForm({paciente_id:"",paciente:"",procedimento_id:"",servico:"",profissional_id:"",data:diaSelecionado,hora:horaPreenchida||"09:00",duracao_minutos:60,status:"aguardando",observacoes:""});
  };

  const salvarBloqueio = async () => {
    if(!formBloqueio.profissional_id) return;
    await insert("bloqueios_agenda",{
      profissional_id:parseInt(formBloqueio.profissional_id),
      data_inicio:formBloqueio.data_inicio, data_fim:formBloqueio.data_fim,
      motivo:formBloqueio.motivo,
    });
    setBloqueioModal(false);
    setFormBloqueio({profissional_id:"",data_inicio:today(),data_fim:today(),motivo:""});
  };

  const mudarDia = (delta) => {
    const d = new Date(diaSelecionado+"T12:00:00");
    d.setDate(d.getDate()+delta);
    setDiaSelecionado(d.toISOString().split("T")[0]);
  };

  const fimHora = (hora, duracao) => {
    const [h,m] = hora.split(":").map(Number);
    const total = h*60+m+(Number(duracao)||60);
    return `${String(Math.floor(total/60)).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`;
  };

  /* ── Dados para a visão de MÊS ── */
  const [mesRef,setMesRef] = useState(()=>{const d=new Date(diaSelecionado+"T12:00:00");return {ano:d.getFullYear(),mes:d.getMonth()};});
  const diasDoMes = useMemo(()=>{
    const primeiro = new Date(mesRef.ano, mesRef.mes, 1);
    const ultimo = new Date(mesRef.ano, mesRef.mes+1, 0);
    const offsetInicio = primeiro.getDay(); // 0=domingo
    const dias=[];
    for(let i=0;i<offsetInicio;i++) dias.push(null);
    for(let dia=1;dia<=ultimo.getDate();dia++){
      const iso = `${mesRef.ano}-${String(mesRef.mes+1).padStart(2,"0")}-${String(dia).padStart(2,"0")}`;
      const ags = data.agendamentos.filter(a=>a.data===iso && (!filt.profissional||String(a.profissional_id)===filt.profissional) && a.status!=="cancelado");
      const bloqueios = (data.bloqueios_agenda||[]).filter(b=>(!filt.profissional||String(b.profissional_id)===filt.profissional)&&iso>=b.data_inicio&&iso<=b.data_fim)
        .map(b=>({...b, profNome: data.profissionais.find(p=>p.id===b.profissional_id)?.nome || "Profissional"}));
      dias.push({iso, dia, qtd:ags.length, bloqueios});
    }
    return dias;
  },[mesRef,data.agendamentos,data.bloqueios_agenda,data.profissionais,filt.profissional]);

  const mudarMes = (delta) => setMesRef(m=>{
    const novo = new Date(m.ano, m.mes+delta, 1);
    return {ano:novo.getFullYear(), mes:novo.getMonth()};
  });

  /* ── Dados para a visão de SEMANA ── */
  const diasDaSemana = useMemo(()=>{
    const d = new Date(diaSelecionado+"T12:00:00");
    const diaSemana = d.getDay();
    const domingo = new Date(d); domingo.setDate(d.getDate()-diaSemana);
    return Array.from({length:7},(_,i)=>{
      const dt = new Date(domingo); dt.setDate(domingo.getDate()+i);
      const iso = dt.toISOString().split("T")[0];
      const ags = data.agendamentos.filter(a=>a.data===iso && (!filt.profissional||String(a.profissional_id)===filt.profissional) && a.status!=="cancelado").sort((a,b)=>a.hora.localeCompare(b.hora));
      const bloqueios = (data.bloqueios_agenda||[]).filter(b=>(!filt.profissional||String(b.profissional_id)===filt.profissional)&&iso>=b.data_inicio&&iso<=b.data_fim)
        .map(b=>({...b, prof: data.profissionais.find(p=>p.id===b.profissional_id)}));
      return {iso, label:dt.toLocaleDateString("pt-BR",{weekday:"short",day:"2-digit"}), ags, bloqueios};
    });
  },[diaSelecionado,data.agendamentos,data.bloqueios_agenda,data.profissionais,filt.profissional]);

  const nomesMeses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

  return(
    <div>
      <PH title="Agendamentos" sub={`${lista.length} registros no total`}>
        <div style={{display:"flex",gap:5,marginRight:6,flexWrap:"wrap"}}>
          {[["mes","Mês"],["semana","Semana"],["dia","Dia"],["lista","Lista"]].map(([id,label])=>(
            <button key={id} onClick={()=>setVisao(id)} style={{padding:"7px 13px",borderRadius:8,border:`1px solid ${visao===id?C.accent:C.border}`,background:visao===id?C.accentSoft:"transparent",color:visao===id?C.accent:C.muted,fontSize:12,fontWeight:visao===id?700:400,cursor:"pointer"}}>{label}</button>
          ))}
        </div>
        <Btn v="g" onClick={()=>setBloqueioModal(true)}><I.Lock s={12}/> Bloquear período</Btn>
        <Btn onClick={()=>{abrirModal();setModal(true);}}><I.Plus s={12}/> Novo</Btn>
      </PH>

      {(visao==="mes"||visao==="semana"||visao==="dia")&&
        <FilterBar filters={[{key:"profissional",type:"select",label:"Profissional",options:data.profissionais.map(p=>({value:String(p.id),label:p.nome}))}]} values={{profissional:filt.profissional}} onChange={ff}/>
      }

      {/* ── VISÃO MÊS ── */}
      {visao==="mes"&&<>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 14px"}}>
          <button onClick={()=>mudarMes(-1)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,width:32,height:32,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><I.Arrow c={C.muted} s={14} style={{transform:"rotate(180deg)"}}/></button>
          <div style={{color:C.text,fontWeight:700,fontSize:15}}>{nomesMeses[mesRef.mes]} {mesRef.ano}</div>
          <button onClick={()=>mudarMes(1)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,width:32,height:32,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><I.Arrow c={C.muted} s={14}/></button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6,marginBottom:6}}>
          {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(d=><div key={d} style={{textAlign:"center",color:C.muted,fontSize:10,fontWeight:700,padding:"4px 0"}}>{d}</div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6}}>
          {diasDoMes.map((d,i)=>d===null
            ? <div key={"vazio"+i}/>
            : <button key={d.iso} onClick={()=>{setDiaSelecionado(d.iso);setVisao("dia");}}
                title={d.bloqueios.length>0 ? d.bloqueios.map(b=>`${b.profNome}${b.motivo?` — ${b.motivo}`:""}`).join("\n") : undefined}
                style={{aspectRatio:"1",minHeight:64,background:d.bloqueios.length>0?C.danger+"0C":(d.iso===today()?C.accentSoft:C.card),border:`1.5px solid ${d.bloqueios.length>0?C.danger+"70":C.border}`,borderRadius:9,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,padding:4,position:"relative"}}>
                <span style={{color:d.iso===today()?C.accent:C.text,fontWeight:d.iso===today()?700:500,fontSize:12}}>{d.dia}</span>
                {d.qtd>0&&<span style={{background:C.accent,color:"#FFFFFF",borderRadius:20,fontSize:9,fontWeight:700,padding:"1px 6px"}}>{d.qtd}</span>}
                {d.bloqueios.length>0&&<>
                  <div style={{position:"absolute",top:3,right:3,background:C.danger,borderRadius:"50%",width:18,height:18,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <I.Lock c="#FFFFFF" s={11}/>
                  </div>
                  <div style={{display:"flex",gap:2,marginTop:1}}>
                    {d.bloqueios.slice(0,3).map(b=>{const prof=data.profissionais.find(p=>p.id===b.profissional_id);return(
                      <div key={b.id} style={{width:7,height:7,borderRadius:"50%",background:prof?.cor||C.danger}}/>
                    );})}
                  </div>
                </>}
              </button>
          )}
        </div>
        <p style={{color:C.muted,fontSize:10,marginTop:8,textAlign:"center"}}>Passe o mouse sobre um dia bloqueado para ver profissional e motivo.</p>
      </>}

      {/* ── VISÃO SEMANA ── */}
      {visao==="semana"&&<>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 14px"}}>
          <button onClick={()=>mudarDia(-7)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,width:32,height:32,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><I.Arrow c={C.muted} s={14} style={{transform:"rotate(180deg)"}}/></button>
          <div style={{color:C.text,fontWeight:700,fontSize:13}}>{diasDaSemana[0]?.iso&&fmtDate(diasDaSemana[0].iso)} — {diasDaSemana[6]?.iso&&fmtDate(diasDaSemana[6].iso)}</div>
          <button onClick={()=>mudarDia(7)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,width:32,height:32,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><I.Arrow c={C.muted} s={14}/></button>
        </div>
        <div className="g1" style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:8}}>
          {diasDaSemana.map(dia=>(
            <div key={dia.iso} onClick={()=>{setDiaSelecionado(dia.iso);setVisao("dia");}}
              title={dia.bloqueios.length>0?dia.bloqueios.map(b=>`${b.prof?.nome||"Profissional"}${b.motivo?` — ${b.motivo}`:""}`).join("\n"):undefined}
              style={{background:dia.bloqueios.length>0?C.danger+"0C":(dia.iso===today()?C.accentSoft:C.card),border:`1.5px solid ${dia.bloqueios.length>0?C.danger+"60":C.border}`,borderRadius:10,padding:8,cursor:"pointer",minHeight:110,position:"relative"}}>
              <div style={{color:dia.iso===today()?C.accent:C.text,fontWeight:700,fontSize:11,textTransform:"capitalize",marginBottom:6,textAlign:"center"}}>{dia.label}</div>
              {dia.bloqueios.length>0&&
                <div style={{position:"absolute",top:5,right:5,background:C.danger,borderRadius:"50%",width:18,height:18,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <I.Lock c="#FFFFFF" s={11}/>
                </div>
              }
              {dia.ags.slice(0,3).map(a=>{const p=data.profissionais.find(pr=>pr.id===a.profissional_id);return(
                <div key={a.id} style={{background:(p?.cor||C.accent)+"18",borderLeft:`2px solid ${p?.cor||C.accent}`,borderRadius:4,padding:"3px 5px",marginBottom:3,fontSize:9}}>
                  <div style={{color:C.text,fontWeight:600}}>{a.hora}</div>
                  <div style={{color:C.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{a.paciente}</div>
                </div>
              );})}
              {dia.ags.length>3&&<div style={{color:C.muted,fontSize:9,textAlign:"center"}}>+{dia.ags.length-3} mais</div>}
              {dia.ags.length===0&&dia.bloqueios.length===0&&<div style={{color:C.muted,fontSize:9,textAlign:"center",marginTop:10}}>—</div>}
              {dia.bloqueios.length>0&&<div style={{color:C.danger,fontSize:8,textAlign:"center",marginTop:4,fontWeight:600}}>{dia.bloqueios[0].prof?.nome?.split(" ")[0]||"Bloqueado"}</div>}
            </div>
          ))}
        </div>
      </>}

      {/* ── VISÃO DIA (cards) ── */}
      {visao==="dia"&&<>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 14px"}}>
          <button onClick={()=>mudarDia(-1)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,width:32,height:32,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><I.Arrow c={C.muted} s={14} style={{transform:"rotate(180deg)"}}/></button>
          <div style={{textAlign:"center"}}>
            <div style={{color:C.text,fontWeight:700,fontSize:15}}>{new Date(diaSelecionado+"T12:00:00").toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long"})}</div>
            <button onClick={()=>setDiaSelecionado(today())} style={{background:"none",border:"none",color:C.accent,fontSize:11,cursor:"pointer",marginTop:2}}>Ir para hoje</button>
          </div>
          <button onClick={()=>mudarDia(1)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,width:32,height:32,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><I.Arrow c={C.muted} s={14}/></button>
        </div>

        {bloqueiosDoDia.length>0&&
          <div style={{background:C.danger+"0F",border:`1.5px solid ${C.danger}40`,borderRadius:12,padding:"12px 14px",marginBottom:14,display:"flex",flexDirection:"column",gap:8}}>
            {bloqueiosDoDia.map(b=>(
              <div key={b.id} style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:C.danger,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <I.Lock c="#FFFFFF" s={16}/>
                </div>
                <div>
                  <div style={{color:C.danger,fontWeight:700,fontSize:13}}>{b.prof?.nome||"Profissional"} — agenda bloqueada</div>
                  <div style={{color:C.text,fontSize:11,marginTop:1}}>{b.motivo||"Sem motivo informado"} · {fmtDate(b.data_inicio)} até {fmtDate(b.data_fim)}</div>
                </div>
              </div>
            ))}
          </div>
        }

        {doDia.length===0
          ? <div style={{background:C.card,border:`1px dashed ${C.border}`,borderRadius:13,padding:36,textAlign:"center"}}>
              <I.Cal c={C.muted} s={28}/>
              <p style={{color:C.muted,fontSize:13,marginTop:10}}>Nenhum agendamento neste dia.</p>
              <Btn onClick={()=>{abrirModal();setModal(true);}} style={{marginTop:10}}><I.Plus s={12}/> Agendar horário</Btn>
            </div>
          : <div className="g1" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))",gap:12}}>
              {doDia.map(ag=>{
                const p=data.profissionais.find(pr=>pr.id===ag.profissional_id);
                const cor = p?.cor||C.accent;
                return(
                  <div key={ag.id} className="fc" style={{background:C.card,border:`1px solid ${C.border}`,borderLeft:`4px solid ${cor}`,borderRadius:12,padding:14,boxShadow:"0 1px 8px #7C5CBF0A"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                      <div>
                        <div style={{color:C.text,fontWeight:700,fontSize:16}}>{ag.hora}</div>
                        <div style={{color:C.muted,fontSize:10}}>até {fimHora(ag.hora,ag.duracao_minutos||60)} · {ag.duracao_minutos||60}min</div>
                      </div>
                      <Badge text={ag.status} color={sc[ag.status]||C.muted}/>
                    </div>
                    <div style={{marginBottom:8}}>
                      <div style={{color:C.text,fontSize:13,fontWeight:600}}>{ag.paciente}</div>
                      <div style={{color:C.muted,fontSize:12,marginTop:1}}>{ag.servico}</div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10,paddingTop:8,borderTop:`1px solid ${C.border}`}}>
                      <div style={{width:20,height:20,borderRadius:"50%",background:cor+"22",display:"flex",alignItems:"center",justifyContent:"center",color:cor,fontWeight:700,fontSize:9}}>{p?.nome?.[0]||"?"}</div>
                      <span style={{color:C.muted,fontSize:11}}>{p?.nome||"—"}</span>
                      <span style={{marginLeft:"auto",color:C.accent,fontWeight:700,fontSize:12}}>{fmt(ag.valor)}</span>
                    </div>
                    <div style={{display:"flex",gap:5}}>
                      {ag.status==="aguardando"&&<Btn v="ok" onClick={()=>confirmar(ag.id)} style={{flex:1,justifyContent:"center",padding:"5px 0",fontSize:11}}><I.Check s={11}/> Confirmar</Btn>}
                      {(ag.status==="confirmado"||ag.status==="aguardando")&&<Btn v="i" onClick={()=>realizar(ag)} style={{flex:1,justifyContent:"center",padding:"5px 0",fontSize:11}}>Realizar</Btn>}
                      {ag.status!=="cancelado"&&ag.status!=="realizado"&&<Btn v="d" onClick={()=>cancelar(ag.id)} style={{padding:"5px 9px"}}><I.X s={11}/></Btn>}
                    </div>
                  </div>
                );
              })}
            </div>
        }
      </>}

      {/* ── VISÃO LISTA ── */}
      {visao==="lista"&&<>
        <FilterBar filters={[{key:"de",type:"date",label:"De"},{key:"ate",type:"date",label:"Até"},{key:"profissional",type:"select",label:"Profissional",options:data.profissionais.map(p=>({value:String(p.id),label:p.nome}))},{key:"procedimento",type:"select",label:"Procedimento",options:data.procedimentos.map(p=>({value:String(p.id),label:p.nome}))},{key:"status",type:"select",label:"Status",options:["aguardando","confirmado","realizado","cancelado"].map(s=>({value:s,label:s}))}]} values={filt} onChange={ff}/>
        <ST cols={["Paciente","Procedimento","Profissional","Data","Hora","Valor","Status","Ações"]}
          rows={lista.map(ag=>{const p=data.profissionais.find(p=>p.id===ag.profissional_id);return[
            <span style={{fontWeight:600}}>{ag.paciente}</span>,ag.servico,
            <span style={{color:p?.cor||C.accent,fontWeight:600}}>{p?.nome?.split(" ").slice(0,2).join(" ")}</span>,
            fmtDate(ag.data),<span style={{fontWeight:700}}>{ag.hora}</span>,
            <span style={{color:C.accent,fontWeight:700}}>{fmt(ag.valor)}</span>,
            <Badge text={ag.status} color={sc[ag.status]||C.muted}/>,
            <div style={{display:"flex",gap:4}}>
              {ag.status==="aguardando"&&<Btn v="ok" onClick={()=>confirmar(ag.id)} style={{padding:"3px 7px"}}><I.Check s={11}/></Btn>}
              {(ag.status==="confirmado"||ag.status==="aguardando")&&<Btn v="i" onClick={()=>realizar(ag)} style={{padding:"3px 7px",fontSize:10}}>Realizar</Btn>}
              {ag.status!=="cancelado"&&ag.status!=="realizado"&&<Btn v="d" onClick={()=>cancelar(ag.id)} style={{padding:"3px 7px"}}><I.X s={11}/></Btn>}
            </div>
          ];})}
        />
      </>}

      {/* MODAL NOVO AGENDAMENTO */}
      {modal&&<Mod title="Novo Agendamento" onClose={()=>setModal(false)}>
        <PacienteBusca pacientes={data.pacientes} value={form.paciente_id} insert={insert}
          onChange={(id,nome)=>setForm(f=>({...f,paciente_id:id,paciente:nome}))}/>
        <Sel label="Procedimento" value={form.procedimento_id} onChange={e=>{const proc=data.procedimentos.find(p=>p.id===parseInt(e.target.value));setForm(f=>({...f,procedimento_id:e.target.value,servico:proc?.nome||"",duracao_minutos:proc?.duracao_minutos||f.duracao_minutos}));}} options={[{value:"",label:"Selecione..."}, ...data.procedimentos.filter(p=>p.ativo).map(p=>({value:p.id,label:`${p.nome} — ${fmt(p.preco_venda)}`}))]}/>
        <Sel label="Profissional" value={form.profissional_id} onChange={e=>setForm(f=>({...f,profissional_id:e.target.value}))} options={[{value:"",label:"Selecione..."}, ...data.profissionais.map(p=>({value:p.id,label:p.nome}))]}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
          <Inp label="Data" type="date" value={form.data} onChange={e=>setForm(f=>({...f,data:e.target.value}))}/>
          <Inp label="Hora" type="time" value={form.hora} onChange={e=>setForm(f=>({...f,hora:e.target.value}))}/>
          <Inp label="Duração (min)" type="number" value={form.duracao_minutos} onChange={e=>setForm(f=>({...f,duracao_minutos:e.target.value}))}/>
        </div>
        <TA label="Observações" value={form.observacoes} onChange={e=>setForm(f=>({...f,observacoes:e.target.value}))} placeholder="Observações sobre o agendamento..."/>
        {erroSalvar&&<div style={{background:C.danger+"14",border:`1px solid ${C.danger}30`,borderRadius:8,padding:"9px 12px",marginBottom:8,color:C.danger,fontSize:12}}>{erroSalvar}</div>}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}>
          <Btn v="g" onClick={()=>setModal(false)}>Cancelar</Btn>
          <Btn onClick={salvar} disabled={!form.paciente_id||!form.procedimento_id||!form.profissional_id||salvando}>
            {salvando?<><Spin s={12} c="#FFFFFF"/>Salvando...</>:<><I.Check s={12}/> Agendar</>}
          </Btn>
        </div>
      </Mod>}

      {/* MODAL BLOQUEAR PERÍODO */}
      {bloqueioModal&&<Mod title="Bloquear Período da Agenda" onClose={()=>setBloqueioModal(false)}>
        <p style={{color:C.muted,fontSize:12,marginBottom:12}}>Use para férias, folgas ou qualquer período em que o profissional não deve receber agendamentos.</p>
        <Sel label="Profissional" value={formBloqueio.profissional_id} onChange={e=>setFormBloqueio(f=>({...f,profissional_id:e.target.value}))} options={[{value:"",label:"Selecione..."}, ...data.profissionais.map(p=>({value:p.id,label:p.nome}))]}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Inp label="De" type="date" value={formBloqueio.data_inicio} onChange={e=>setFormBloqueio(f=>({...f,data_inicio:e.target.value}))}/>
          <Inp label="Até" type="date" value={formBloqueio.data_fim} onChange={e=>setFormBloqueio(f=>({...f,data_fim:e.target.value}))}/>
        </div>
        <Inp label="Motivo (opcional)" value={formBloqueio.motivo} onChange={e=>setFormBloqueio(f=>({...f,motivo:e.target.value}))} placeholder="Ex: Férias, congresso..."/>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}>
          <Btn v="g" onClick={()=>setBloqueioModal(false)}>Cancelar</Btn>
          <Btn v="d" onClick={salvarBloqueio} disabled={!formBloqueio.profissional_id}><I.Lock s={12}/> Bloquear</Btn>
        </div>
      </Mod>}
    </div>
  );
}



/* ─── ATENDIMENTOS ───────────────────────────────────────────── */
function Atendimentos({data,insert,update}) {
  const [modal,setModal] = useState(false);
  const [filt,setFilt] = useState({profissional:"",de:"",ate:"",pago:""});
  const ff = (k,v) => setFilt(p=>({...p,[k]:v}));

  // Cabeçalho do atendimento
  const [cab,setCab] = useState({paciente_id:"",paciente:"",profissional_id:"",data:today(),desconto:"0",pago:false,forma_pagamento_id:"",conta_id:"",observacoes:""});
  // Itens do atendimento (produtos e procedimentos)
  const [itens,setItens] = useState([]);
  const fc = (k,v) => setCab(p=>({...p,[k]:v}));

  const addItem = () => setItens(l=>[...l,{tipo:"procedimento",ref_id:"",descricao:"",quantidade:1,valor_unitario:0,valor_total:0}]);

  const updItem = (idx,k,v) => setItens(l=>l.map((item,i)=>{
    if(i!==idx) return item;
    const up = {...item,[k]:v};
    if(k==="ref_id"||k==="tipo") {
      if(up.tipo==="procedimento") {
        const proc = data.procedimentos.find(p=>p.id===parseInt(up.ref_id));
        if(proc){ up.descricao=proc.nome; up.valor_unitario=proc.preco_venda; up.valor_total=proc.preco_venda*(Number(up.quantidade)||1); }
      } else {
        const prod = data.produtos.find(p=>p.id===parseInt(up.ref_id));
        if(prod){ up.descricao=prod.nome; up.valor_unitario=prod.preco_venda||prod.custo_unitario; up.valor_total=(prod.preco_venda||prod.custo_unitario)*(Number(up.quantidade)||1); }
      }
    }
    if(k==="quantidade"||k==="valor_unitario") {
      up.valor_total = (Number(up.valor_unitario)||0)*(Number(up.quantidade)||0);
    }
    return up;
  }));

  const rmItem = idx => setItens(l=>l.filter((_,i)=>i!==idx));

  const totalItens = itens.reduce((s,i)=>s+(Number(i.valor_total)||0),0);
  const desconto = Number(cab.desconto)||0;
  const valorFinal = Math.max(0, totalItens - desconto);

  const lista = useMemo(()=>{
    let l=[...data.atendimentos];
    if(filt.profissional) l=l.filter(a=>String(a.profissional_id)===filt.profissional);
    if(filt.de) l=l.filter(a=>a.data>=filt.de);
    if(filt.ate) l=l.filter(a=>a.data<=filt.ate);
    if(filt.pago==="sim") l=l.filter(a=>a.pago);
    if(filt.pago==="nao") l=l.filter(a=>!a.pago);
    return l.sort((a,b)=>b.data.localeCompare(a.data));
  },[data.atendimentos,filt]);

  const totalRec = lista.reduce((s,a)=>s+(Number(a.valor_final||a.valor)||0),0);
  const totalPago = lista.filter(a=>a.pago).reduce((s,a)=>s+(Number(a.valor_final||a.valor)||0),0);

  const toggle = id => {
    const at=data.atendimentos.find(a=>a.id===id);
    const novoPago = !at.pago;
    update("atendimentos",id,{pago:novoPago});
    /* Gera comissão pendente quando o atendimento passa a "pago" (só profissionais por %) */
    if(novoPago) gerarComissaoSeAplicavel(at);
  };

  /* Gera um registro de comissão pendente para o profissional, se ele for remunerado por percentual */
  const gerarComissaoSeAplicavel = async (atendimento) => {
    const prof = data.profissionais.find(p=>p.id===atendimento.profissional_id);
    if(!prof || prof.tipo!=="percentual") return;
    const jaExiste = (data.comissoes||[]).find(c=>c.atendimento_id===atendimento.id);
    if(jaExiste) return;
    const valorFinal = Number(atendimento.valor_final||atendimento.valor)||0;
    const pct = Number(prof.percentual)||0;
    await insert("comissoes",{
      atendimento_id:atendimento.id, profissional_id:prof.id,
      paciente:atendimento.paciente, servico:atendimento.servico,
      valor_atendimento:valorFinal, percentual:pct,
      valor_comissao:valorFinal*pct/100,
      status:"pendente", data_atendimento:atendimento.data,
    });
  };

  const abrirModal = () => {
    setCab({paciente_id:"",paciente:"",profissional_id:"",data:today(),desconto:"0",pago:false,forma_pagamento_id:"",conta_id:"",observacoes:""});
    setItens([{tipo:"procedimento",ref_id:"",descricao:"",quantidade:1,valor_unitario:0,valor_total:0}]);
    setModal(true);
  };

  const salvar = async () => {
    if(!cab.paciente_id||!cab.profissional_id||itens.length===0) return;
    const fp = data.formas_pagamento.find(f=>f.id===parseInt(cab.forma_pagamento_id));
    const descNomes = itens.map(i=>i.descricao).filter(Boolean).join(", ");

    // 1. Salvar cabeçalho do atendimento
    const novoAt = await insert("atendimentos",{
      paciente_id:parseInt(cab.paciente_id), paciente:cab.paciente,
      profissional_id:parseInt(cab.profissional_id),
      servico:descNomes, data:cab.data,
      valor:totalItens, desconto:desconto, valor_final:valorFinal,
      pago:cab.pago,
      forma_pagamento_id:cab.forma_pagamento_id?parseInt(cab.forma_pagamento_id):null,
      forma_pagamento:fp?.nome||"",
      conta_id:cab.conta_id?parseInt(cab.conta_id):null,
      observacoes:cab.observacoes,
    });
    const atId = novoAt?.id || Date.now();

    // 2. Salvar itens e baixar estoque
    for(const item of itens) {
      if(!item.ref_id) continue;
      await insert("atendimento_itens",{
        atendimento_id:atId, tipo:item.tipo,
        procedimento_id:item.tipo==="procedimento"?parseInt(item.ref_id):null,
        produto_id:item.tipo==="produto"?parseInt(item.ref_id):null,
        descricao:item.descricao, quantidade:Number(item.quantidade),
        valor_unitario:Number(item.valor_unitario), valor_total:Number(item.valor_total),
      });

      if(item.tipo==="procedimento") {
        // Baixa insumos vinculados ao procedimento
        const insumos = (data.procedimento_insumos||[]).filter(pi=>pi.procedimento_id===parseInt(item.ref_id));
        for(const ins of insumos) {
          const prod = data.produtos.find(p=>p.id===ins.produto_id);
          if(!prod) continue;
          const qtdBaixa = (Number(ins.quantidade)||0)*(Number(item.quantidade)||1);
          const novoEst = Math.max(0,(Number(prod.estoque_atual)||0)-qtdBaixa);
          await update("produtos",prod.id,{estoque_atual:novoEst});
          await insert("estoque_movimentacoes",{
            produto_id:prod.id, tipo:"uso_procedimento",
            quantidade:qtdBaixa, custo_unitario:Number(prod.custo_unitario)||0,
            custo_total:qtdBaixa*(Number(prod.custo_unitario)||0),
            estoque_anterior:Number(prod.estoque_atual)||0, estoque_atual:novoEst,
            origem:"atendimento", origem_id:atId, data:cab.data,
          });
        }
      }

      if(item.tipo==="produto") {
        // Baixa direta do produto vendido
        const prod = data.produtos.find(p=>p.id===parseInt(item.ref_id));
        if(prod) {
          const qtdBaixa = Number(item.quantidade)||1;
          const novoEst = Math.max(0,(Number(prod.estoque_atual)||0)-qtdBaixa);
          await update("produtos",prod.id,{estoque_atual:novoEst});
          await insert("estoque_movimentacoes",{
            produto_id:prod.id, tipo:"saida",
            quantidade:qtdBaixa, custo_unitario:Number(prod.custo_unitario)||0,
            custo_total:qtdBaixa*(Number(prod.custo_unitario)||0),
            estoque_anterior:Number(prod.estoque_atual)||0, estoque_atual:novoEst,
            origem:"venda", origem_id:atId, data:cab.data,
          });
        }
      }
    }

    // 3. Conta a receber (sempre cria, mesmo se pago — marca status)
    const catAtendimentos = (data.categorias_financeiras||[]).find(c=>c.tipo==="receita"&&c.nome==="Atendimentos");
    await insert("contas_receber",{
      paciente:cab.paciente, paciente_id:parseInt(cab.paciente_id),
      atendimento_id:atId,
      descricao:`Atendimento — ${descNomes}`,
      valor:valorFinal, vencimento:cab.data,
      categoria_id:catAtendimentos?.id||null,
      data_lancamento:today(), data_competencia:cab.data,
      status:cab.pago?"quitado":"aberto",
      forma_pagamento:fp?.nome||"",
      forma_pagamento_id:cab.forma_pagamento_id?parseInt(cab.forma_pagamento_id):null,
      conta_id:cab.conta_id?parseInt(cab.conta_id):null,
      data_baixa:cab.pago?cab.data:null,
    });

    // 4. Movimentação financeira se pago
    if(cab.pago && cab.conta_id) {
      await insert("movimentacoes",{
        conta_id:parseInt(cab.conta_id), tipo:"entrada",
        origem:"atendimento", origem_id:atId,
        descricao:`Recebimento — ${cab.paciente}`,
        valor:valorFinal, data:cab.data,
      });
    }

    // 5. Gera comissão pendente se já nasce pago
    if(cab.pago) {
      await gerarComissaoSeAplicavel({id:atId, profissional_id:parseInt(cab.profissional_id), paciente:cab.paciente, servico:descNomes, valor_final:valorFinal, data:cab.data});
    }

    setModal(false);
  };

  return (
    <div>
      <PH title="Atendimentos" sub={`${lista.length} registros`}>
        <Btn onClick={abrirModal}><I.Plus s={12}/> Lançar Atendimento</Btn>
      </PH>

      <div className="stat-row" style={{display:"flex",gap:9,marginBottom:13,flexWrap:"wrap"}}>
        <SC label="Total" value={fmt(totalRec)} Icon={I.Up} color={C.success}/>
        <SC label="Recebido" value={fmt(totalPago)} Icon={I.Check} color={C.success}/>
        <SC label="Pendente" value={fmt(totalRec-totalPago)} Icon={I.Warn} color={C.warn}/>
        <SC label="Qtd." value={lista.length} Icon={I.Receipt} color={C.info}/>
      </div>

      <FilterBar filters={[
        {key:"de",type:"date",label:"De"},
        {key:"ate",type:"date",label:"Até"},
        {key:"profissional",type:"select",label:"Profissional",options:data.profissionais.map(p=>({value:String(p.id),label:p.nome}))},
        {key:"pago",type:"select",label:"Situação",options:[{value:"sim",label:"Pago"},{value:"nao",label:"Pendente"}]},
      ]} values={filt} onChange={ff}/>

      <ST cols={["Paciente","Serviços","Profissional","Data","Valor","Forma Pgto","Situação","Ação"]}
        rows={lista.map(at=>{
          const p=data.profissionais.find(p=>p.id===at.profissional_id);
          const atItens=(data.atendimento_itens||[]).filter(i=>i.atendimento_id===at.id);
          return [
            <span style={{fontWeight:600}}>{at.paciente}</span>,
            <span style={{fontSize:11,color:C.muted}}>{atItens.length>0?atItens.map(i=>i.descricao).join(", "):at.servico}</span>,
            <span style={{color:p?.cor||C.accent,fontWeight:600,fontSize:11}}>{p?.nome?.split(" ")[0]}</span>,
            fmtDate(at.data),
            <span style={{color:C.accent,fontWeight:700}}>{fmt(at.valor_final||at.valor)}</span>,
            <span style={{color:C.muted,fontSize:11}}>{at.forma_pagamento||"—"}</span>,
            <Badge text={at.pago?"Pago":"Pendente"} color={at.pago?C.success:C.warn}/>,
            <Btn v={at.pago?"g":"ok"} onClick={()=>toggle(at.id)} style={{padding:"3px 9px",fontSize:10}}>
              {at.pago?"Estornar":"Receber"}
            </Btn>
          ];
        })}
      />

      {modal&&<Mod title="Lançar Atendimento" onClose={()=>setModal(false)} full>
        {/* Cabeçalho */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
          <PacienteBusca pacientes={data.pacientes} value={cab.paciente_id} insert={insert}
            onChange={(id,nome)=>{fc("paciente_id",id);fc("paciente",nome);}}/>
          <Sel label="Profissional" value={cab.profissional_id}
            onChange={e=>fc("profissional_id",e.target.value)}
            options={[{value:"",label:"Selecione..."}, ...data.profissionais.map(p=>({value:p.id,label:p.nome}))]}/>
          <Inp label="Data do Atendimento" type="date" value={cab.data} onChange={e=>fc("data",e.target.value)}/>
        </div>

        {/* Itens */}
        <div style={{background:C.surface,borderRadius:10,padding:13,marginBottom:14,border:`1px solid ${C.border}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <span style={{color:C.text,fontSize:12,fontWeight:700}}>Produtos e Procedimentos</span>
            <Btn v="g" onClick={addItem} style={{fontSize:11,padding:"4px 10px"}}><I.Plus s={11}/> Adicionar item</Btn>
          </div>

          {itens.length===0&&<p style={{color:C.muted,fontSize:12,textAlign:"center",padding:"12px 0"}}>Nenhum item adicionado. Clique em "Adicionar item".</p>}

          {itens.map((item,idx)=>(
            <div key={idx} style={{display:"grid",gridTemplateColumns:"120px 1fr 80px 110px 110px 36px",gap:8,marginBottom:8,alignItems:"end"}}>
              <div>
                {idx===0&&<label style={{display:"block",color:C.muted,fontSize:10,letterSpacing:.9,textTransform:"uppercase",marginBottom:4}}>Tipo</label>}
                <select value={item.tipo} onChange={e=>updItem(idx,"tipo",e.target.value)}
                  style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 10px",color:C.text,fontSize:12}}>
                  <option value="procedimento">Procedimento</option>
                  <option value="produto">Produto</option>
                </select>
              </div>
              <div>
                {idx===0&&<label style={{display:"block",color:C.muted,fontSize:10,letterSpacing:.9,textTransform:"uppercase",marginBottom:4}}>
                  {item.tipo==="procedimento"?"Procedimento":"Produto"}
                </label>}
                <select value={item.ref_id} onChange={e=>updItem(idx,"ref_id",e.target.value)}
                  style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 10px",color:C.text,fontSize:12}}>
                  <option value="">Selecione...</option>
                  {item.tipo==="procedimento"
                    ? data.procedimentos.filter(p=>p.ativo).map(p=><option key={p.id} value={p.id}>{p.nome} — {fmt(p.preco_venda)}</option>)
                    : data.produtos.filter(p=>p.ativo).map(p=><option key={p.id} value={p.id}>{p.nome} — {fmt(p.preco_venda||p.custo_unitario)}</option>)
                  }
                </select>
              </div>
              <Inp label={idx===0?"Qtd.":""} type="number" value={item.quantidade} onChange={e=>updItem(idx,"quantidade",e.target.value)} style={{textAlign:"center"}}/>
              <Inp label={idx===0?"Valor Unit. R$":""} type="number" value={item.valor_unitario} onChange={e=>updItem(idx,"valor_unitario",e.target.value)}/>
              <div>
                {idx===0&&<label style={{display:"block",color:C.muted,fontSize:10,letterSpacing:.9,textTransform:"uppercase",marginBottom:4}}>Subtotal</label>}
                <div style={{background:C.accentSoft,border:`1px solid ${C.accent}30`,borderRadius:8,padding:"9px 10px",color:C.accent,fontWeight:700,fontSize:13,textAlign:"right"}}>
                  {fmt(item.valor_total)}
                </div>
              </div>
              <div style={{paddingBottom:0}}>
                {idx===0&&<div style={{height:22,marginBottom:4}}/>}
                <button onClick={()=>rmItem(idx)} style={{width:"100%",height:38,background:C.danger+"18",border:`1px solid ${C.danger}30`,borderRadius:8,color:C.danger,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <I.X c={C.danger} s={13}/>
                </button>
              </div>
            </div>
          ))}

          {itens.length>0&&<div style={{borderTop:`1px solid ${C.border}`,marginTop:10,paddingTop:10,display:"flex",justifyContent:"flex-end",gap:16}}>
            <span style={{color:C.muted,fontSize:12}}>Subtotal dos itens:</span>
            <span style={{color:C.text,fontWeight:700,fontSize:14}}>{fmt(totalItens)}</span>
          </div>}
        </div>

        {/* Pagamento */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10,marginBottom:12}}>
          <Inp label="Desconto (R$)" type="number" value={cab.desconto} onChange={e=>fc("desconto",e.target.value)}/>
          <div>
            <label style={{display:"block",color:C.muted,fontSize:10,letterSpacing:.9,textTransform:"uppercase",marginBottom:4}}>Valor Final</label>
            <div style={{background:C.accentSoft,border:`1px solid ${C.accent}`,borderRadius:8,padding:"9px 12px",color:C.accent,fontWeight:700,fontSize:15,textAlign:"center"}}>
              {fmt(valorFinal)}
            </div>
          </div>
          <Sel label="Forma de Pagamento" value={cab.forma_pagamento_id}
            onChange={e=>fc("forma_pagamento_id",e.target.value)}
            options={[{value:"",label:"Selecione..."}, ...data.formas_pagamento.map(f=>({value:f.id,label:f.nome}))]}/>
          <Sel label="Conta de Destino" value={cab.conta_id}
            onChange={e=>fc("conta_id",e.target.value)}
            options={[{value:"",label:"Selecione..."}, ...data.contas_bancarias.map(c=>({value:c.id,label:`${c.nome} (${c.tipo})`}))]}/>
        </div>

        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
          <input type="checkbox" checked={cab.pago} onChange={e=>fc("pago",e.target.checked)} id="pgAt" style={{accentColor:C.accent,width:16,height:16}}/>
          <label htmlFor="pgAt" style={{color:C.text,fontSize:13,cursor:"pointer"}}>Já recebeu o pagamento</label>
        </div>

        <TA label="Observações" value={cab.observacoes} onChange={e=>fc("observacoes",e.target.value)} placeholder="Observações sobre o atendimento..."/>

        <div style={{background:C.info+"10",border:`1px solid ${C.info}25`,borderRadius:8,padding:"8px 12px",marginBottom:12,display:"flex",gap:8,alignItems:"center"}}>
          <I.Warn c={C.info} s={13}/>
          <span style={{color:C.info,fontSize:11}}>
            Ao salvar: <strong>estoque</strong> dos insumos será baixado automaticamente · <strong>Conta a receber</strong> será criada · Se marcado como pago, <strong>movimentação financeira</strong> será registrada.
          </span>
        </div>

        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Btn v="g" onClick={()=>setModal(false)}>Cancelar</Btn>
          <Btn onClick={salvar} disabled={!cab.paciente_id||!cab.profissional_id||itens.length===0||itens.every(i=>!i.ref_id)}>
            <I.Check s={12}/> Salvar Atendimento
          </Btn>
        </div>
      </Mod>}
    </div>
  );
}

/* ─── PACIENTES ──────────────────────────────────────────────── */
function Pacientes({data,insert,update,dadosCompletos,user}) {
  const [modal,setModal]=useState(false);
  const [ficha,setFicha]=useState(null);
  const [anamneseModal,setAnamneseModal]=useState(null);
  const [filt,setFilt]=useState({busca:"",tag:""});
  const ff=(k,v)=>setFilt(p=>({...p,[k]:v}));
  const [form,setForm]=useState({nome:"",cpf:"",telefone:"",whatsapp:"",email:"",nascimento:"",sexo:"",profissao:"",endereco:"",cidade:"",estado:"",cep:"",como_conheceu:"",observacoes:""});
  const [filtroTimeline,setFiltroTimeline]=useState("todos"); /* "todos" ou id do profissional */
  const isSupervisor = !user || user.role !== "profissional";
  /* Fonte completa (todos os profissionais) para a linha do tempo compartilhada */
  const full = dadosCompletos || data;

  const lista=useMemo(()=>{
    let l=[...data.pacientes];
    if(filt.busca){const b=filt.busca.toLowerCase();l=l.filter(p=>p.nome.toLowerCase().includes(b)||p.cpf?.includes(filt.busca)||p.telefone?.includes(filt.busca)||p.email?.toLowerCase().includes(b));}
    if(filt.tag) l=l.filter(p=>p.tags?.includes(filt.tag));
    return l;
  },[data.pacientes,filt]);

  const salvar=async()=>{await insert("pacientes",{...form,cpf:maskCPF(form.cpf),telefone:maskFone(form.telefone),whatsapp:maskFone(form.whatsapp)});setModal(false);};
  const handleSaveAnamnese=async(formAnamnese)=>{
    const existente=data.anamneses.find(a=>a.paciente_id===anamneseModal.id);
    if(existente){await update("anamneses",existente.id,{...formAnamnese,updated_at:new Date().toISOString()});}
    else{await insert("anamneses",{...formAnamnese,paciente_id:anamneseModal.id});}
    setAnamneseModal(null);
  };

  const todasTags=[...new Set(data.pacientes.flatMap(p=>p.tags||[]))];

  /* Linha do tempo completa do paciente, com todos os profissionais que já o atenderam */
  const timeline = useMemo(()=>{
    if(!ficha) return [];
    let ats = full.atendimentos.filter(a=>a.paciente_id===ficha.id||a.paciente===ficha.nome);
    if(filtroTimeline!=="todos") ats = ats.filter(a=>String(a.profissional_id)===filtroTimeline);
    return ats.sort((a,b)=>(b.data||"").localeCompare(a.data||""));
  },[ficha,full.atendimentos,filtroTimeline]);

  /* Lista de profissionais que já atenderam este paciente, para montar o filtro */
  const profissionaisDoTimeline = useMemo(()=>{
    if(!ficha) return [];
    const ids = new Set(full.atendimentos.filter(a=>a.paciente_id===ficha.id||a.paciente===ficha.nome).map(a=>a.profissional_id));
    return full.profissionais.filter(p=>ids.has(p.id));
  },[ficha,full.atendimentos,full.profissionais]);

  return(
    <div>
      <PH title="Pacientes" sub={`${lista.length} de ${data.pacientes.length} cadastrados`}><Btn onClick={()=>setModal(true)}><I.Plus s={12}/> Cadastrar</Btn></PH>
      <FilterBar filters={[{key:"busca",type:"text",label:"Buscar por nome, CPF, telefone..."},{key:"tag",type:"select",label:"Tag",options:todasTags.map(t=>({value:t,label:t}))}]} values={filt} onChange={ff}/>

      <ST cols={["Nome","CPF","WhatsApp","Última visita","Total gasto","Visitas","Tags","Ações"]}
        rows={lista.map(p=>{const anamnese=data.anamneses.find(a=>a.paciente_id===p.id);return[
          <span style={{fontWeight:600,color:C.text}}>{p.nome}</span>,
          <span style={{color:C.muted,fontSize:11}}>{p.cpf||"—"}</span>,
          <span style={{color:C.muted,fontSize:11}}>{p.whatsapp||p.telefone||"—"}</span>,
          <span style={{fontSize:11}}>{fmtDate(p.ultima_visita)}</span>,
          <span style={{color:C.accent,fontWeight:700}}>{fmt(p.total_gasto||0)}</span>,
          <span style={{color:C.info,fontWeight:600}}>{p.total_visitas||0}</span>,
          <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>{(p.tags||[]).map(t=><Badge key={t} text={t} color={C.purple}/>)}</div>,
          <div style={{display:"flex",gap:4}}>
            <Btn v="g" onClick={()=>{setFicha(p);setFiltroTimeline("todos");}} style={{padding:"3px 7px"}}><I.Eye s={11}/></Btn>
            <Btn v={anamnese?"ok":"warn"} onClick={()=>setAnamneseModal(p)} style={{padding:"3px 7px",fontSize:9}}>{anamnese?"Anamnese ✓":"Anamnese"}</Btn>
          </div>
        ];})}
      />

      {modal&&<Mod title="Novo Paciente" onClose={()=>setModal(false)} wide>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Inp label="Nome completo" value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} style={{gridColumn:"1/-1"}}/>
          <Inp label="CPF" value={form.cpf} onChange={e=>setForm(f=>({...f,cpf:maskCPF(e.target.value)}))} placeholder="000.000.000-00"/>
          <Inp label="Data de Nascimento" type="date" value={form.nascimento} onChange={e=>setForm(f=>({...f,nascimento:e.target.value}))}/>
          <Inp label="Telefone" value={form.telefone} onChange={e=>setForm(f=>({...f,telefone:maskFone(e.target.value)}))} placeholder="(11) 99999-9999"/>
          <Inp label="WhatsApp" value={form.whatsapp} onChange={e=>setForm(f=>({...f,whatsapp:maskFone(e.target.value)}))} placeholder="(11) 99999-9999"/>
          <Inp label="E-mail" type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} style={{gridColumn:"1/-1"}}/>
          <Sel label="Sexo" value={form.sexo} onChange={e=>setForm(f=>({...f,sexo:e.target.value}))} options={[{value:"",label:"Selecione..."},{value:"F",label:"Feminino"},{value:"M",label:"Masculino"},{value:"O",label:"Outro"}]}/>
          <Inp label="Profissão" value={form.profissao} onChange={e=>setForm(f=>({...f,profissao:e.target.value}))}/>
          <Sel label="Como nos conheceu?" value={form.como_conheceu} onChange={e=>setForm(f=>({...f,como_conheceu:e.target.value}))} options={[{value:"",label:"Selecione..."},{value:"Instagram",label:"Instagram"},{value:"Google",label:"Google"},{value:"Indicação",label:"Indicação"},{value:"Facebook",label:"Facebook"},{value:"TikTok",label:"TikTok"},{value:"Outro",label:"Outro"}]}/>
          <Inp label="CEP" value={form.cep} onChange={e=>setForm(f=>({...f,cep:maskCEP(e.target.value)}))} placeholder="00000-000"/>
          <Inp label="Cidade" value={form.cidade} onChange={e=>setForm(f=>({...f,cidade:e.target.value}))}/>
          <Sel label="Estado" value={form.estado} onChange={e=>setForm(f=>({...f,estado:e.target.value}))} options={[{value:"",label:"UF"},...["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(uf=>({value:uf,label:uf}))]}/>
        </div>
        <TA label="Observações / Alergias" value={form.observacoes} onChange={e=>setForm(f=>({...f,observacoes:e.target.value}))}/>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Btn v="g" onClick={()=>setModal(false)}>Cancelar</Btn>
          <Btn onClick={salvar} disabled={!form.nome}><I.Check s={12}/> Salvar</Btn>
        </div>
      </Mod>}

      {ficha&&<Mod title={`Ficha — ${ficha.nome}`} onClose={()=>setFicha(null)} full>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:9,marginBottom:14}}>
          {[["CPF",ficha.cpf],["WhatsApp",ficha.whatsapp||ficha.telefone],["E-mail",ficha.email],["Nascimento",fmtDate(ficha.nascimento)],["Como conheceu",ficha.como_conheceu],["Cidade/UF",ficha.cidade&&ficha.estado?`${ficha.cidade}/${ficha.estado}`:"—"]].map(([l,v])=>(
            <div key={l} style={{background:C.surface,borderRadius:8,padding:"8px 10px"}}><div style={{color:C.muted,fontSize:9,textTransform:"uppercase",marginBottom:2}}>{l}</div><div style={{color:C.text,fontSize:12,fontWeight:600}}>{v||"—"}</div></div>
          ))}
        </div>
        <div className="stat-row" style={{display:"flex",gap:9,marginBottom:14,flexWrap:"wrap"}}>
          <SC label="Total gasto" value={fmt(ficha.total_gasto||0)} Icon={I.Dollar} color={C.accent}/>
          <SC label="Visitas" value={ficha.total_visitas||0} Icon={I.Receipt} color={C.info}/>
          <SC label="Última visita" value={fmtDate(ficha.ultima_visita)} Icon={I.Cal} color={C.success}/>
        </div>
        {ficha.observacoes&&<div style={{background:C.warn+"14",border:`1px solid ${C.warn}28`,borderRadius:8,padding:"8px 10px",marginBottom:12}}><div style={{color:C.warn,fontSize:10,fontWeight:700,marginBottom:2}}>ALERTAS</div><div style={{color:C.text,fontSize:12}}>{ficha.observacoes}</div></div>}

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}}>
          <h4 style={{color:C.text,fontSize:12,fontWeight:700}}>Linha do Tempo — Histórico Completo de Tratamentos</h4>
          <Btn v={data.anamneses.find(a=>a.paciente_id===ficha.id)?"ok":"warn"} onClick={()=>{setFicha(null);setAnamneseModal(ficha);}} style={{fontSize:10,padding:"4px 10px"}}>
            {data.anamneses.find(a=>a.paciente_id===ficha.id)?"✓ Ver Anamnese":"+ Preencher Anamnese"}
          </Btn>
        </div>

        {/* Filtro por profissional — visível quando mais de um profissional já atendeu este paciente */}
        {profissionaisDoTimeline.length>0&&
          <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
            <span style={{color:C.muted,fontSize:11}}>Filtrar por:</span>
            <button onClick={()=>setFiltroTimeline("todos")} style={{padding:"4px 11px",borderRadius:20,border:`1px solid ${filtroTimeline==="todos"?C.accent:C.border}`,background:filtroTimeline==="todos"?C.accentSoft:"transparent",color:filtroTimeline==="todos"?C.accent:C.muted,fontSize:11,fontWeight:filtroTimeline==="todos"?700:400,cursor:"pointer"}}>
              Todos os profissionais
            </button>
            {isSupervisor
              ? profissionaisDoTimeline.map(prof=>(
                  <button key={prof.id} onClick={()=>setFiltroTimeline(String(prof.id))} style={{padding:"4px 11px",borderRadius:20,border:`1px solid ${filtroTimeline===String(prof.id)?prof.cor:C.border}`,background:filtroTimeline===String(prof.id)?prof.cor+"18":"transparent",color:filtroTimeline===String(prof.id)?prof.cor:C.muted,fontSize:11,fontWeight:filtroTimeline===String(prof.id)?700:400,cursor:"pointer"}}>
                    {prof.nome}
                  </button>
                ))
              : <button onClick={()=>setFiltroTimeline(String(user.profissionalId))} style={{padding:"4px 11px",borderRadius:20,border:`1px solid ${filtroTimeline===String(user.profissionalId)?C.accent:C.border}`,background:filtroTimeline===String(user.profissionalId)?C.accentSoft:"transparent",color:filtroTimeline===String(user.profissionalId)?C.accent:C.muted,fontSize:11,fontWeight:filtroTimeline===String(user.profissionalId)?700:400,cursor:"pointer"}}>
                  Somente meus atendimentos
                </button>
            }
          </div>
        }

        {/* Linha do tempo visual */}
        {timeline.length===0
          ?<p style={{color:C.muted,fontSize:12}}>Nenhum atendimento registrado{filtroTimeline!=="todos"?" com este filtro":""}.</p>
          :<div style={{position:"relative",paddingLeft:22}}>
            <div style={{position:"absolute",left:5,top:6,bottom:6,width:2,background:C.border}}/>
            {timeline.map((at,idx)=>{
              const prof=full.profissionais.find(p=>p.id===at.profissional_id);
              return(
                <div key={at.id} style={{position:"relative",marginBottom:idx===timeline.length-1?0:16}}>
                  <div style={{position:"absolute",left:-22,top:3,width:12,height:12,borderRadius:"50%",background:prof?.cor||C.accent,border:`2px solid ${C.card}`,boxShadow:`0 0 0 2px ${prof?.cor||C.accent}30`}}/>
                  <div style={{background:C.surface,borderRadius:10,padding:"10px 13px",border:`1px solid ${C.border}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:4}}>
                      <div>
                        <div style={{color:C.text,fontSize:13,fontWeight:700}}>{at.servico}</div>
                        <div style={{color:C.muted,fontSize:10,marginTop:1}}>{fmtDate(at.data)}</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{color:C.accent,fontWeight:700,fontSize:13}}>{fmt(at.valor_final||at.valor)}</div>
                        <Badge text={at.pago?"Pago":"Pendente"} color={at.pago?C.success:C.warn}/>
                      </div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginTop:6}}>
                      <div style={{width:16,height:16,borderRadius:"50%",background:(prof?.cor||C.accent)+"22",display:"flex",alignItems:"center",justifyContent:"center",color:prof?.cor||C.accent,fontWeight:700,fontSize:8}}>{prof?.nome?.[0]||"?"}</div>
                      <span style={{color:C.muted,fontSize:11}}>{prof?.nome||"Profissional não identificado"}</span>
                      {at.forma_pagamento&&<span style={{color:C.muted,fontSize:10}}>· {at.forma_pagamento}</span>}
                    </div>
                    {at.observacoes&&<div style={{color:C.muted,fontSize:11,marginTop:6,fontStyle:"italic"}}>"{at.observacoes}"</div>}
                  </div>
                </div>
              );
            })}
          </div>
        }
      </Mod>}

      {anamneseModal&&<AnamneseModal paciente={anamneseModal} existente={data.anamneses.find(a=>a.paciente_id===anamneseModal.id)} onClose={()=>setAnamneseModal(null)} onSave={handleSaveAnamnese}/>}
    </div>
  );
}


/* ─── FORNECEDORES ───────────────────────────────────────────── */
function Fornecedores({data,insert,update,remove}) {
  const [modal,setModal]=useState(false);const [editing,setEditing]=useState(null);
  const init={razao_social:"",nome_fantasia:"",cnpj:"",email:"",telefone:"",whatsapp:"",contato_nome:"",endereco:"",cidade:"",estado:"",cep:"",observacoes:""};
  const [form,setForm]=useState(init);const f=(k,v)=>setForm(p=>({...p,[k]:v}));
  const abrir=(item)=>{if(item){setEditing(item);setForm(item);}else{setEditing(null);setForm(init);}setModal(true);};
  const salvar=async()=>{if(editing){await update("fornecedores",editing.id,form);}else{await insert("fornecedores",form);}setModal(false);};
  return(
    <div>
      <PH title="Fornecedores" sub={`${data.fornecedores.length} cadastrados`}><Btn onClick={()=>abrir(null)}><I.Plus s={12}/> Cadastrar</Btn></PH>
      <ST cols={["Fornecedor","CNPJ","Contato","Telefone","WhatsApp","Cidade","Ações"]}
        rows={data.fornecedores.map(f=>[
          <div><div style={{fontWeight:600,color:C.text}}>{f.nome_fantasia||f.razao_social}</div><div style={{color:C.muted,fontSize:10}}>{f.razao_social}</div></div>,
          <span style={{color:C.muted,fontSize:11}}>{f.cnpj||"—"}</span>,
          <span style={{fontSize:11}}>{f.contato_nome||"—"}</span>,
          <span style={{color:C.muted,fontSize:11}}>{f.telefone||"—"}</span>,
          <a href={`https://wa.me/55${(f.whatsapp||"").replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{color:C.success,fontSize:11,display:"flex",alignItems:"center",gap:3,textDecoration:"none"}}><I.Whatsapp c={C.success} s={12}/>{f.whatsapp||"—"}</a>,
          <span style={{fontSize:11}}>{f.cidade&&f.estado?`${f.cidade}/${f.estado}`:"—"}</span>,
          <div style={{display:"flex",gap:4}}>
            <Btn v="g" onClick={()=>abrir(f)} style={{padding:"3px 7px"}}><I.Edit s={11}/></Btn>
            <Btn v="d" onClick={()=>remove("fornecedores",f.id)} style={{padding:"3px 7px"}}><I.X s={11}/></Btn>
          </div>
        ])}
      />
      {modal&&<Mod title={editing?"Editar Fornecedor":"Novo Fornecedor"} onClose={()=>setModal(false)} wide>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Inp label="Razão Social" value={form.razao_social} onChange={e=>f("razao_social",e.target.value)} style={{gridColumn:"1/-1"}}/>
          <Inp label="Nome Fantasia" value={form.nome_fantasia} onChange={e=>f("nome_fantasia",e.target.value)}/>
          <Inp label="CNPJ" value={form.cnpj} onChange={e=>f("cnpj",maskCNPJ(e.target.value))} placeholder="00.000.000/0001-00"/>
          <Inp label="E-mail" type="email" value={form.email} onChange={e=>f("email",e.target.value)} style={{gridColumn:"1/-1"}}/>
          <Inp label="Telefone" value={form.telefone} onChange={e=>f("telefone",maskFone(e.target.value))} placeholder="(11) 3333-3333"/>
          <Inp label="WhatsApp" value={form.whatsapp} onChange={e=>f("whatsapp",maskFone(e.target.value))} placeholder="(11) 99999-9999"/>
          <Inp label="Nome do Contato" value={form.contato_nome} onChange={e=>f("contato_nome",e.target.value)} style={{gridColumn:"1/-1"}}/>
          <Inp label="CEP" value={form.cep} onChange={e=>f("cep",maskCEP(e.target.value))} placeholder="00000-000"/>
          <Inp label="Cidade" value={form.cidade} onChange={e=>f("cidade",e.target.value)}/>
          <Inp label="Endereço" value={form.endereco} onChange={e=>f("endereco",e.target.value)} style={{gridColumn:"1/-1"}}/>
        </div>
        <TA label="Observações" value={form.observacoes} onChange={e=>f("observacoes",e.target.value)}/>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Btn v="g" onClick={()=>setModal(false)}>Cancelar</Btn>
          <Btn onClick={salvar} disabled={!form.razao_social}><I.Check s={12}/> Salvar</Btn>
        </div>
      </Mod>}
    </div>
  );
}

/* ─── PRODUTOS ───────────────────────────────────────────────── */
function Produtos({data,insert,update,remove}) {
  const [modal,setModal]=useState(false);const [editing,setEditing]=useState(null);
  const init={fornecedor_id:"",nome:"",descricao:"",categoria:"",unidade:"unidade",custo_unitario:0,preco_venda:0,markup:0,estoque_atual:0,estoque_inicial:0,estoque_minimo:2,ativo:true};
  const [form,setForm]=useState(init);const f=(k,v)=>setForm(p=>({...p,[k]:v}));
  const abrir=(item)=>{if(item){setEditing(item);setForm(item);}else{setEditing(null);setForm(init);}setModal(true);};
  const calcMarkup=()=>{const c=Number(form.custo_unitario)||0;const mk=Number(form.markup)||0;if(c>0&&mk>0){const pv=c*(1+mk/100);setForm(p=>({...p,preco_venda:pv.toFixed(2)}));}};
  const salvar=async()=>{const rec={...form,fornecedor_id:form.fornecedor_id?parseInt(form.fornecedor_id):null,custo_unitario:Number(form.custo_unitario),preco_venda:Number(form.preco_venda),markup:Number(form.markup),estoque_atual:Number(form.estoque_atual),estoque_inicial:Number(form.estoque_atual),estoque_minimo:Number(form.estoque_minimo)};if(editing){await update("produtos",editing.id,rec);}else{await insert("produtos",rec);}setModal(false);};
  return(
    <div>
      <PH title="Produtos" sub={`${data.produtos.length} cadastrados`}><Btn onClick={()=>abrir(null)}><I.Plus s={12}/> Cadastrar</Btn></PH>
      <ST cols={["Produto","Categoria","Fornecedor","Custo","Markup","P. Venda","Estoque","Status","Ações"]}
        rows={data.produtos.map(p=>{const forn=data.fornecedores.find(f=>f.id===p.fornecedor_id);const critico=p.estoque_atual<=p.estoque_minimo;return[
          <div><div style={{fontWeight:600,color:C.text,fontSize:12}}>{p.nome}</div><div style={{color:C.muted,fontSize:10}}>{p.unidade}</div></div>,
          <span style={{color:C.muted,fontSize:11}}>{p.categoria||"—"}</span>,
          <span style={{fontSize:11}}>{forn?.nome_fantasia||"—"}</span>,
          <span style={{color:C.danger,fontWeight:600}}>{fmt(p.custo_unitario)}</span>,
          <span style={{color:C.info,fontSize:11}}>{fmtN(p.markup)}%</span>,
          <span style={{color:C.success,fontWeight:600}}>{fmt(p.preco_venda)}</span>,
          <span style={{color:critico?C.danger:C.success,fontWeight:700}}>{fmtN(p.estoque_atual)} {p.unidade}</span>,
          <Badge text={p.ativo?"Ativo":"Inativo"} color={p.ativo?C.success:C.muted}/>,
          <div style={{display:"flex",gap:4}}>
            <Btn v="g" onClick={()=>abrir(p)} style={{padding:"3px 7px"}}><I.Edit s={11}/></Btn>
            <Btn v="d" onClick={()=>remove("produtos",p.id)} style={{padding:"3px 7px"}}><I.X s={11}/></Btn>
          </div>
        ];})}
      />
      {modal&&<Mod title={editing?"Editar Produto":"Novo Produto"} onClose={()=>setModal(false)} wide>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Inp label="Nome do produto" value={form.nome} onChange={e=>f("nome",e.target.value)} style={{gridColumn:"1/-1"}}/>
          <Sel label="Fornecedor" value={form.fornecedor_id||""} onChange={e=>f("fornecedor_id",e.target.value)} options={[{value:"",label:"Selecione..."}, ...data.fornecedores.map(forn=>({value:forn.id,label:forn.nome_fantasia||forn.razao_social}))]}/>
          <Inp label="Categoria" value={form.categoria} onChange={e=>f("categoria",e.target.value)} placeholder="Injetável, Skincare, EPI..."/>
          <Inp label="Unidade" value={form.unidade} onChange={e=>f("unidade",e.target.value)} placeholder="frasco, caixa, ml..."/>
          <Inp label="Custo unitário (R$)" type="number" value={form.custo_unitario} onChange={e=>f("custo_unitario",e.target.value)} onBlur={calcMarkup}/>
          <Inp label="Markup (%)" type="number" value={form.markup} onChange={e=>f("markup",e.target.value)} onBlur={calcMarkup}/>
          <Inp label="Preço de venda (R$)" type="number" value={form.preco_venda} onChange={e=>f("preco_venda",e.target.value)}/>
          <Inp label="Estoque atual" type="number" value={form.estoque_atual} onChange={e=>f("estoque_atual",e.target.value)}/>
          <Inp label="Estoque mínimo" type="number" value={form.estoque_minimo} onChange={e=>f("estoque_minimo",e.target.value)}/>
        </div>
        <TA label="Descrição" value={form.descricao} onChange={e=>f("descricao",e.target.value)} placeholder="Descrição do produto..."/>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Btn v="g" onClick={()=>setModal(false)}>Cancelar</Btn>
          <Btn onClick={salvar} disabled={!form.nome}><I.Check s={12}/> Salvar</Btn>
        </div>
      </Mod>}
    </div>
  );
}


/* ─── PROCEDIMENTOS ──────────────────────────────────────────── */
function Procedimentos({data,insert,update,remove}) {
  const [modal,setModal]=useState(false);const [editing,setEditing]=useState(null);const [simModal,setSimModal]=useState(false);
  const init={nome:"",categoria:"",duracao_minutos:60,preco_venda:0,markup:0,custo_insumos:0,custo_fixo:0,custo_total:0,margem:0,descricao:"",ativo:true};
  const [form,setForm]=useState(init);const [insumos,setInsumos]=useState([]);
  const [sim,setSim]=useState({dias_uteis:22,horas_dia:8,duracao:60});
  const ff=(k,v)=>setForm(p=>({...p,[k]:v}));

  /* Despesas fixas mensais = contas a pagar recorrentes com vencimento no mês corrente
     (se ainda não houver nenhuma lançada neste mês, cai para o mês mais recente com lançamentos) */
  const despesasFixasMes = useMemo(()=>{
    const {de,ate}=mesAtualRange();
    const doMes=(data.contas_pagar||[]).filter(c=>c.recorrente&&c.vencimento>=de&&c.vencimento<=ate);
    if(doMes.length>0) return doMes.reduce((s,d)=>s+(Number(d.valor)||0),0);
    const recorrentes=(data.contas_pagar||[]).filter(c=>c.recorrente).sort((a,b)=>(b.vencimento||"").localeCompare(a.vencimento||""));
    if(recorrentes.length===0) return 0;
    const ultimoMes=recorrentes[0].vencimento.slice(0,7);
    return recorrentes.filter(c=>c.vencimento.slice(0,7)===ultimoMes).reduce((s,d)=>s+(Number(d.valor)||0),0);
  },[data.contas_pagar]);
  const calcCustos=(f)=>{const ci=insumos.reduce((s,i)=>s+(Number(i.custo_total)||0),0);const pv=Number(f.preco_venda)||0;const cf=Number(f.custo_fixo)||0;const ct=ci+cf;const mg=pv>0?Math.round((pv-ct)/pv*100):0;return{custo_insumos:ci,custo_total:ct,margem:mg};};

  const abrir=(item)=>{
    if(item){setEditing(item);setForm(item);const ins=(data.procedimento_insumos||[]).filter(i=>i.procedimento_id===item.id).map(i=>{const prod=data.produtos.find(p=>p.id===i.produto_id);return{...i,produto_nome:prod?.nome||""};});setInsumos(ins);}
    else{setEditing(null);setForm(init);setInsumos([]);}
    setModal(true);
  };

  const addInsumo=()=>setInsumos(l=>[...l,{produto_id:"",produto_nome:"",quantidade:1,custo_unitario:0,custo_total:0}]);
  const updInsumo=(idx,k,v)=>setInsumos(l=>l.map((item,i)=>{if(i!==idx)return item;const updated={...item,[k]:v};if(k==="produto_id"){const prod=data.produtos.find(p=>p.id===parseInt(v));if(prod){updated.custo_unitario=prod.custo_unitario;updated.produto_nome=prod.nome;updated.custo_total=(Number(updated.quantidade)||1)*prod.custo_unitario;}}if(k==="quantidade"||k==="custo_unitario"){updated.custo_total=(Number(updated.quantidade)||0)*(Number(updated.custo_unitario)||0);}return updated;}));
  const rmInsumo=(idx)=>setInsumos(l=>l.filter((_,i)=>i!==idx));

  const calcSimulador=()=>{const tf=despesasFixasMes;const horasMes=(Number(sim.dias_uteis)||22)*(Number(sim.horas_dia)||8);const custoHora=horasMes>0?tf/horasMes:0;const duracaoH=(Number(sim.duracao)||60)/60;const custoFixo=custoHora*duracaoH;setForm(p=>({...p,custo_fixo:custoFixo.toFixed(2),duracao_minutos:Number(sim.duracao)}));setSimModal(false);};

  const salvar=async()=>{
    const custos=calcCustos(form);
    const rec={...form,...custos,preco_venda:Number(form.preco_venda),markup:Number(form.markup),custo_fixo:Number(form.custo_fixo),duracao_minutos:Number(form.duracao_minutos)};
    let procId;
    if(editing){
      await update("procedimentos",editing.id,rec);
      procId=editing.id;
      // Remove todos os insumos antigos antes de salvar os novos (evita duplicatas)
      if(!DEMO_MODE){
        await fetch(`${SUPABASE_URL}/rest/v1/procedimento_insumos?procedimento_id=eq.${procId}`,{method:"DELETE",headers:getHeaders()});
      }
    } else {
      const novo=await insert("procedimentos",rec);
      procId=novo?.id||Date.now();
    }
    // Salva insumos novos
    for(const ins of insumos){
      if(!ins.produto_id) continue;
      await insert("procedimento_insumos",{
        procedimento_id:procId,
        produto_id:parseInt(ins.produto_id),
        quantidade:Number(ins.quantidade),
        custo_unitario:Number(ins.custo_unitario),
        custo_total:Number(ins.custo_total),
      });
    }
    setModal(false);
  };

  const custos=calcCustos(form);

  return(
    <div>
      <PH title="Procedimentos" sub={`${data.procedimentos.length} cadastrados`}><Btn onClick={()=>abrir(null)}><I.Plus s={12}/> Cadastrar</Btn></PH>
      <ST cols={["Procedimento","Categoria","Duração","Custo Total","Preço","Margem","Status","Ações"]}
        rows={data.procedimentos.map(p=>[
          <span style={{fontWeight:600,color:C.text}}>{p.nome}</span>,
          <span style={{color:C.muted,fontSize:11}}>{p.categoria||"—"}</span>,
          <span style={{fontSize:11}}>{p.duracao_minutos}min</span>,
          <span style={{color:C.danger,fontWeight:600}}>{fmt(p.custo_total)}</span>,
          <span style={{color:C.success,fontWeight:700}}>{fmt(p.preco_venda)}</span>,
          <Badge text={`${p.margem}%`} color={p.margem>60?C.success:p.margem>35?C.warn:C.danger}/>,
          <Badge text={p.ativo?"Ativo":"Inativo"} color={p.ativo?C.success:C.muted}/>,
          <div style={{display:"flex",gap:4}}>
            <Btn v="g" onClick={()=>abrir(p)} style={{padding:"3px 7px"}}><I.Edit s={11}/></Btn>
            <Btn v="d" onClick={()=>remove("procedimentos",p.id)} style={{padding:"3px 7px"}}><I.X s={11}/></Btn>
          </div>
        ])}
      />
      {modal&&<Mod title={editing?"Editar Procedimento":"Novo Procedimento"} onClose={()=>setModal(false)} full>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
          <Inp label="Nome" value={form.nome} onChange={e=>ff("nome",e.target.value)} style={{gridColumn:"1/-1"}}/>
          <Inp label="Categoria" value={form.categoria} onChange={e=>ff("categoria",e.target.value)} placeholder="Facial, Corporal, Skincare..."/>
          <Inp label="Duração (min)" type="number" value={form.duracao_minutos} onChange={e=>ff("duracao_minutos",e.target.value)}/>
          <Inp label="Preço de venda (R$)" type="number" value={form.preco_venda} onChange={e=>ff("preco_venda",e.target.value)}/>
          <Inp label="Markup (%)" type="number" value={form.markup} onChange={e=>ff("markup",e.target.value)}/>
          <div style={{gridColumn:"1/-1",display:"flex",alignItems:"center",gap:10}}>
            <Inp label="Custo Fixo — Despesas (R$)" type="number" value={form.custo_fixo} onChange={e=>ff("custo_fixo",e.target.value)} style={{flex:1}}/>
            <Btn v="i" onClick={()=>setSimModal(true)} style={{marginTop:14,whiteSpace:"nowrap"}}><I.Calculator s={12}/> Simular</Btn>
          </div>
        </div>

        {/* Resumo de custos */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,background:C.surface,borderRadius:9,padding:12,marginBottom:14}}>
          {[["Insumos",fmt(custos.custo_insumos),C.danger],["Custo Fixo",fmt(Number(form.custo_fixo)||0),C.warn],["Custo Total",fmt(custos.custo_total),C.danger],["Margem",`${custos.margem}%`,custos.margem>60?C.success:custos.margem>35?C.warn:C.danger]].map(([l,v,c])=>(
            <div key={l} style={{background:C.card,borderRadius:7,padding:"8px 10px"}}><div style={{color:C.muted,fontSize:9,textTransform:"uppercase",marginBottom:2}}>{l}</div><div style={{color:c,fontWeight:700,fontSize:13}}>{v}</div></div>
          ))}
        </div>

        {/* Insumos */}
        <div style={{marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9}}>
            <h4 style={{color:C.text,fontSize:12,fontWeight:700}}>Insumos / Produtos utilizados</h4>
            <Btn v="g" onClick={addInsumo} style={{fontSize:10,padding:"3px 9px"}}><I.Plus s={11}/> Adicionar</Btn>
          </div>
          {insumos.map((ins,idx)=>(
            <div key={idx} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr auto",gap:8,marginBottom:8,alignItems:"end"}}>
              <Sel label={idx===0?"Produto":""} value={ins.produto_id||""} onChange={e=>updInsumo(idx,"produto_id",e.target.value)} options={[{value:"",label:"Selecione..."}, ...data.produtos.map(p=>({value:p.id,label:p.nome}))]}/>
              <Inp label={idx===0?"Qtd":""}  type="number" value={ins.quantidade} onChange={e=>updInsumo(idx,"quantidade",e.target.value)}/>
              <Inp label={idx===0?"Custo unit.":""} type="number" value={ins.custo_unitario} onChange={e=>updInsumo(idx,"custo_unitario",e.target.value)}/>
              <div style={{background:C.surface,borderRadius:8,padding:"9px 10px",fontSize:12,color:C.danger,fontWeight:600}}>{fmt(ins.custo_total)}</div>
              <button onClick={()=>rmInsumo(idx)} style={{background:"none",border:"none",color:C.danger,padding:"8px 4px",cursor:"pointer"}}><I.X s={14}/></button>
            </div>
          ))}
        </div>

        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Btn v="g" onClick={()=>setModal(false)}>Cancelar</Btn>
          <Btn onClick={salvar} disabled={!form.nome}><I.Check s={12}/> Salvar</Btn>
        </div>
      </Mod>}

      {/* SIMULADOR */}
      {simModal&&<Mod title="Simulador de Custo Fixo" onClose={()=>setSimModal(false)}>
        <div style={{background:C.surface,borderRadius:9,padding:12,marginBottom:14}}>
          <div style={{color:C.accent,fontSize:11,fontWeight:700,marginBottom:6}}>Despesas fixas mensais: {fmt(despesasFixasMes)}</div>
          <div style={{color:C.muted,fontSize:11}}>O simulador calcula o custo das despesas fixas proporcionais ao tempo do procedimento. {despesasFixasMes===0&&"Cadastre despesas recorrentes em Financeiro → Contas a Pagar para usar o simulador."}</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
          <Inp label="Dias úteis/mês" type="number" value={sim.dias_uteis} onChange={e=>setSim(s=>({...s,dias_uteis:e.target.value}))}/>
          <Inp label="Horas/dia" type="number" value={sim.horas_dia} onChange={e=>setSim(s=>({...s,horas_dia:e.target.value}))}/>
          <Inp label="Duração (min)" type="number" value={sim.duracao} onChange={e=>setSim(s=>({...s,duracao:e.target.value}))}/>
        </div>
        {(()=>{const tf=despesasFixasMes;const hm=(Number(sim.dias_uteis)||22)*(Number(sim.horas_dia)||8);const ch=hm>0?tf/hm:0;const cf=ch*(Number(sim.duracao)||60)/60;return(
          <div style={{background:C.accentSoft,borderRadius:9,padding:12,margin:"12px 0",textAlign:"center"}}>
            <div style={{color:C.muted,fontSize:11,marginBottom:4}}>Custo fixo calculado para este procedimento</div>
            <div style={{color:C.accent,fontSize:24,fontWeight:700}}>{fmt(cf)}</div>
            <div style={{color:C.muted,fontSize:10,marginTop:3}}>({fmt(ch)}/hora × {Number(sim.duracao)/60}h)</div>
          </div>
        );})()}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Btn v="g" onClick={()=>setSimModal(false)}>Cancelar</Btn>
          <Btn onClick={calcSimulador}><I.Check s={12}/> Aplicar ao Procedimento</Btn>
        </div>
      </Mod>}
    </div>
  );
}


/* ─── ESTOQUE (extrato + entradas) ───────────────────────────── */
function Estoque({data,insert,update}) {
  const [aba,setAba]=useState("extrato");
  const [entradaModal,setEntradaModal] = useState(false);
  const [ajusteModal,setAjusteModal] = useState(null);
  const [filt,setFilt] = useState({produto:"",tipo:"",de:"",ate:""});
  const ff = (k,v) => setFilt(p=>({...p,[k]:v}));
  const [entrada,setEntrada] = useState({fornecedor_id:"",data:today(),vencimento:"",observacoes:"",itens:[]});
  const [ajuste,setAjuste] = useState({tipo:"ajuste_entrada",quantidade:0,observacoes:""});

  const movs=useMemo(()=>{
    let l=[...data.estoque_movimentacoes];
    if(filt.produto) l=l.filter(m=>String(m.produto_id)===filt.produto);
    if(filt.tipo) l=l.filter(m=>m.tipo===filt.tipo);
    if(filt.de) l=l.filter(m=>m.data>=filt.de);
    if(filt.ate) l=l.filter(m=>m.data<=filt.ate);
    return l.sort((a,b)=>(b.data||"").localeCompare(a.data||""));
  },[data.estoque_movimentacoes,filt]);

  const baixo=data.produtos.filter(p=>p.estoque_atual<=p.estoque_minimo);
  const totalEstoque=data.produtos.reduce((s,p)=>s+(Number(p.estoque_atual)||0)*(Number(p.custo_unitario)||0),0);

  const salvarEntrada = async () => {
    const itensValidos = (entrada.itens||[]).filter(i=>i.produto_id&&Number(i.quantidade)>0);
    if(itensValidos.length===0) return;
    const totalCompra = itensValidos.reduce((s,i)=>(s+(Number(i.custo_unitario)||0)*(Number(i.quantidade)||0)),0);
    const forn = data.fornecedores.find(f=>f.id===parseInt(entrada.fornecedor_id));

    // 1. Criar conta a pagar para a compra toda
    const novaCp = await insert("contas_pagar",{
      fornecedor_id:entrada.fornecedor_id?parseInt(entrada.fornecedor_id):null,
      fornecedor:forn?.nome_fantasia||"",
      descricao:`Compra de materiais — ${itensValidos.map(i=>{const p=data.produtos.find(pr=>pr.id===parseInt(i.produto_id));return p?.nome||"";}).join(", ")}`,
      categoria:"Insumos", valor:totalCompra,
      vencimento:entrada.vencimento||today(), status:"aberto",
      observacoes:entrada.observacoes||"",
    });

    // 2. Processar cada item
    for(const item of itensValidos) {
      const prod = data.produtos.find(p=>p.id===parseInt(item.produto_id));
      if(!prod) continue;
      const qt = Number(item.quantidade)||0;
      const cu = Number(item.custo_unitario)||0;
      const esqAnt = Number(prod.estoque_atual)||0;
      const esqNovo = esqAnt + qt;

      // Atualiza estoque e custo
      await update("produtos",prod.id,{estoque_atual:esqNovo, custo_unitario:cu});

      // Registra movimentação de estoque
      await insert("estoque_movimentacoes",{
        produto_id:parseInt(item.produto_id), tipo:"entrada",
        quantidade:qt, custo_unitario:cu, custo_total:qt*cu,
        estoque_anterior:esqAnt, estoque_atual:esqNovo,
        origem:"compra", origem_id:novaCp?.id||null, data:entrada.data||today(),
      });

      // Salva item da compra
      await insert("compra_itens",{
        conta_pagar_id:novaCp?.id||null,
        produto_id:parseInt(item.produto_id),
        quantidade:qt, custo_unitario:cu, custo_total:qt*cu,
        fornecedor_id:entrada.fornecedor_id?parseInt(entrada.fornecedor_id):null,
        data:entrada.data||today(),
      });
    }
    setEntradaModal(false);
    setEntrada({fornecedor_id:"",data:today(),vencimento:"",observacoes:"",itens:[]});
  };

  const salvarAjuste=async()=>{
    if(!ajusteModal)return;
    const prod=ajusteModal;const qt=Number(ajuste.quantidade)||0;const esqAnt=Number(prod.estoque_atual)||0;
    const esqNovo=ajuste.tipo==="ajuste_entrada"?esqAnt+qt:Math.max(0,esqAnt-qt);
    await update("produtos",prod.id,{estoque_atual:esqNovo});
    await insert("estoque_movimentacoes",{produto_id:prod.id,tipo:ajuste.tipo,quantidade:qt,custo_unitario:Number(prod.custo_unitario)||0,custo_total:qt*(Number(prod.custo_unitario)||0),estoque_anterior:esqAnt,estoque_atual:esqNovo,origem:"ajuste",observacoes:ajuste.observacoes,data:today()});
    setAjusteModal(null);
  };

  const tipoColor={entrada:C.success,saida:C.danger,ajuste_entrada:C.info,ajuste_saida:C.warn,uso_procedimento:C.purple};

  return(
    <div>
      <PH title="Estoque" sub={`${data.produtos.length} produtos · ${fmt(totalEstoque)} em estoque`}>
        <Btn v="g" onClick={()=>setEntradaModal(true)}><I.ShoppingCart s={12}/> Entrada de Compra</Btn>
      </PH>
      {baixo.length>0&&<div style={{background:C.danger+"14",border:`1px solid ${C.danger}30`,borderRadius:10,padding:"8px 12px",marginBottom:12}}><div style={{color:C.danger,fontSize:11,fontWeight:700,marginBottom:3}}>⚠ ESTOQUE CRÍTICO</div>{baixo.map(e=><div key={e.id} style={{color:C.text,fontSize:11}}>{e.nome} — {fmtN(e.estoque_atual)} {e.unidade}(s) restante(s)</div>)}</div>}

      <div style={{display:"flex",gap:8,marginBottom:13}}>
        {[["extrato","Extrato de Movimentações"],["produtos","Posição de Estoque"]].map(([id,label])=>(
          <button key={id} onClick={()=>setAba(id)} style={{padding:"7px 16px",borderRadius:8,border:`1px solid ${aba===id?C.accent:C.border}`,background:aba===id?C.accentSoft:"transparent",color:aba===id?C.accent:C.muted,fontSize:12,fontWeight:aba===id?700:400}}>{label}</button>
        ))}
      </div>

      {aba==="extrato"&&<>
        <FilterBar filters={[{key:"produto",type:"select",label:"Produto",options:data.produtos.map(p=>({value:String(p.id),label:p.nome}))},{key:"tipo",type:"select",label:"Tipo",options:["entrada","saida","ajuste_entrada","ajuste_saida"].map(t=>({value:t,label:t}))},{key:"de",type:"date",label:"De"},{key:"ate",type:"date",label:"Até"}]} values={filt} onChange={ff}/>
        <ST cols={["Data","Produto","Tipo","Qtd","Custo Unit.","Total Mov.","Estq. Ant.","Estq. Atual","Origem"]}
          rows={movs.map(m=>{const prod=data.produtos.find(p=>p.id===m.produto_id);return[
            fmtDate(m.data),
            <span style={{fontWeight:600,fontSize:12}}>{prod?.nome||"—"}</span>,
            <Badge text={m.tipo.replace("_"," ")} color={tipoColor[m.tipo]||C.muted}/>,
            <span style={{fontWeight:700,color:m.tipo.includes("entrada")?C.success:C.danger}}>{m.tipo.includes("entrada")?"+":"-"}{fmtN(m.quantidade)} {prod?.unidade||""}</span>,
            <span style={{color:C.muted,fontSize:11}}>{fmt(m.custo_unitario)}</span>,
            <span style={{color:C.accent,fontWeight:600}}>{fmt(m.custo_total)}</span>,
            <span style={{color:C.muted,fontSize:11}}>{fmtN(m.estoque_anterior)}</span>,
            <span style={{fontWeight:600}}>{fmtN(m.estoque_atual)}</span>,
            <span style={{color:C.muted,fontSize:10}}>{m.origem||"—"}</span>,
          ];})}
        />
      </>}

      {aba==="produtos"&&<ST cols={["Produto","Fornecedor","Categoria","Estoque Atual","Mínimo","Custo Unit.","Valor Total","Status","Ajuste"]}
        rows={data.produtos.map(p=>{const forn=data.fornecedores.find(f=>f.id===p.fornecedor_id);const cr=p.estoque_atual<=p.estoque_minimo;return[
          <span style={{fontWeight:600,color:C.text}}>{p.nome}</span>,
          <span style={{fontSize:11}}>{forn?.nome_fantasia||"—"}</span>,
          <span style={{color:C.muted,fontSize:11}}>{p.categoria||"—"}</span>,
          <span style={{color:cr?C.danger:C.success,fontWeight:700}}>{fmtN(p.estoque_atual)} {p.unidade}</span>,
          <span style={{color:C.muted}}>{fmtN(p.estoque_minimo)}</span>,
          <span style={{color:C.accent}}>{fmt(p.custo_unitario)}</span>,
          <span style={{fontWeight:600}}>{fmt(p.estoque_atual*p.custo_unitario)}</span>,
          <Badge text={cr?"Crítico":"OK"} color={cr?C.danger:C.success}/>,
          <Btn v="g" onClick={()=>setAjusteModal(p)} style={{padding:"3px 8px",fontSize:10}}><I.Edit s={11}/> Ajustar</Btn>
        ];})}
      />}

      {/* MODAL ENTRADA — múltiplos produtos */}
      {entradaModal&&<Mod title="Entrada de Compra" onClose={()=>setEntradaModal(false)} full>
        <div style={{background:C.info+"12",border:`1px solid ${C.info}30`,borderRadius:9,padding:"9px 12px",marginBottom:13,display:"flex",gap:8,alignItems:"center"}}>
          <I.Warn c={C.info} s={14}/>
          <span style={{color:C.info,fontSize:12}}>Esta entrada atualizará o estoque e custo de cada produto, e criará <strong>uma conta a pagar</strong> com o total da compra.</span>
        </div>

        {/* Fornecedor e dados gerais */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
          <Sel label="Fornecedor" value={entrada.fornecedor_id}
            onChange={e=>setEntrada(en=>({...en,fornecedor_id:e.target.value}))}
            options={[{value:"",label:"Selecione o fornecedor..."}, ...data.fornecedores.map(f=>({value:f.id,label:f.nome_fantasia||f.razao_social}))]}/>
          <Inp label="Data da compra" type="date" value={entrada.data||today()} onChange={e=>setEntrada(en=>({...en,data:e.target.value}))}/>
          <Inp label="Vencimento do pagamento" type="date" value={entrada.vencimento} onChange={e=>setEntrada(en=>({...en,vencimento:e.target.value}))}/>
        </div>

        {/* Itens da compra */}
        <div style={{background:C.surface,borderRadius:10,padding:13,marginBottom:14,border:`1px solid ${C.border}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <span style={{color:C.text,fontSize:12,fontWeight:700}}>Itens da Compra</span>
            <Btn v="g" onClick={()=>setEntrada(en=>({...en,itens:[...(en.itens||[]),{produto_id:"",quantidade:1,custo_unitario:0,custo_total:0}]}))} style={{fontSize:11,padding:"4px 10px"}}>
              <I.Plus s={11}/> Adicionar produto
            </Btn>
          </div>

          {(entrada.itens||[]).length===0&&<p style={{color:C.muted,fontSize:12,textAlign:"center",padding:"12px 0"}}>Nenhum produto adicionado.</p>}

          {(entrada.itens||[]).map((item,idx)=>(
            <div key={idx} style={{display:"grid",gridTemplateColumns:"2fr 90px 120px 110px 36px",gap:8,marginBottom:8,alignItems:"end"}}>
              <div>
                {idx===0&&<label style={{display:"block",color:C.muted,fontSize:10,letterSpacing:.9,textTransform:"uppercase",marginBottom:4}}>Produto</label>}
                <select value={item.produto_id}
                  onChange={e=>{
                    const prod=data.produtos.find(p=>p.id===parseInt(e.target.value));
                    setEntrada(en=>({...en,itens:en.itens.map((it,i)=>i!==idx?it:{...it,produto_id:e.target.value,custo_unitario:prod?.custo_unitario||0,custo_total:(prod?.custo_unitario||0)*(Number(it.quantidade)||1)})}));
                  }}
                  style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 10px",color:C.text,fontSize:12}}>
                  <option value="">Selecione o produto...</option>
                  {data.produtos.map(p=><option key={p.id} value={p.id}>{p.nome} (estoque: {fmtN(p.estoque_atual)} {p.unidade})</option>)}
                </select>
              </div>
              <div>
                {idx===0&&<label style={{display:"block",color:C.muted,fontSize:10,letterSpacing:.9,textTransform:"uppercase",marginBottom:4}}>Qtd.</label>}
                <input type="number" value={item.quantidade}
                  onChange={e=>setEntrada(en=>({...en,itens:en.itens.map((it,i)=>i!==idx?it:{...it,quantidade:e.target.value,custo_total:(Number(it.custo_unitario)||0)*(Number(e.target.value)||0)})}))}
                  style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 10px",color:C.text,fontSize:12,textAlign:"center"}}/>
              </div>
              <div>
                {idx===0&&<label style={{display:"block",color:C.muted,fontSize:10,letterSpacing:.9,textTransform:"uppercase",marginBottom:4}}>Custo unit. R$</label>}
                <input type="number" value={item.custo_unitario}
                  onChange={e=>setEntrada(en=>({...en,itens:en.itens.map((it,i)=>i!==idx?it:{...it,custo_unitario:e.target.value,custo_total:(Number(e.target.value)||0)*(Number(it.quantidade)||0)})}))}
                  style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 10px",color:C.text,fontSize:12}}/>
              </div>
              <div>
                {idx===0&&<label style={{display:"block",color:C.muted,fontSize:10,letterSpacing:.9,textTransform:"uppercase",marginBottom:4}}>Subtotal</label>}
                <div style={{background:C.accentSoft,borderRadius:8,padding:"9px 10px",color:C.accent,fontWeight:700,fontSize:13,textAlign:"right"}}>
                  {fmt((Number(item.custo_unitario)||0)*(Number(item.quantidade)||0))}
                </div>
              </div>
              <div>
                {idx===0&&<div style={{height:22,marginBottom:4}}/>}
                <button onClick={()=>setEntrada(en=>({...en,itens:en.itens.filter((_,i)=>i!==idx)}))}
                  style={{width:"100%",height:38,background:C.danger+"18",border:`1px solid ${C.danger}30`,borderRadius:8,color:C.danger,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <I.X c={C.danger} s={13}/>
                </button>
              </div>
            </div>
          ))}

          {(entrada.itens||[]).length>0&&<div style={{borderTop:`1px solid ${C.border}`,marginTop:10,paddingTop:10,display:"flex",justifyContent:"flex-end",gap:16}}>
            <span style={{color:C.muted,fontSize:12}}>Total da compra:</span>
            <span style={{color:C.accent,fontWeight:700,fontSize:15}}>{fmt((entrada.itens||[]).reduce((s,i)=>s+(Number(i.custo_unitario)||0)*(Number(i.quantidade)||0),0))}</span>
          </div>}
        </div>

        <TA label="Observações (Nº NF, pedido, etc.)" value={entrada.observacoes} onChange={e=>setEntrada(en=>({...en,observacoes:e.target.value}))} placeholder="Ex: NF 1234, Pedido #5678..."/>

        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Btn v="g" onClick={()=>setEntradaModal(false)}>Cancelar</Btn>
          <Btn onClick={salvarEntrada} disabled={!(entrada.itens||[]).some(i=>i.produto_id&&i.quantidade)}>
            <I.Check s={12}/> Confirmar Entrada
          </Btn>
        </div>
      </Mod>}

      {/* MODAL AJUSTE */}
      {ajusteModal&&<Mod title={`Ajuste de Estoque — ${ajusteModal.nome}`} onClose={()=>setAjusteModal(null)}>
        <div style={{background:C.surface,borderRadius:8,padding:"9px 12px",marginBottom:12}}><span style={{color:C.muted,fontSize:11}}>Estoque atual: </span><span style={{color:C.text,fontWeight:700}}>{fmtN(ajusteModal.estoque_atual)} {ajusteModal.unidade}(s)</span></div>
        <Sel label="Tipo de ajuste" value={ajuste.tipo} onChange={e=>setAjuste(a=>({...a,tipo:e.target.value}))} options={[{value:"ajuste_entrada",label:"Entrada (correção positiva)"},{value:"ajuste_saida",label:"Saída (correção negativa)"}]}/>
        <Inp label="Quantidade" type="number" value={ajuste.quantidade} onChange={e=>setAjuste(a=>({...a,quantidade:e.target.value}))}/>
        <TA label="Motivo do ajuste" value={ajuste.observacoes} onChange={e=>setAjuste(a=>({...a,observacoes:e.target.value}))} placeholder="Inventário, avaria, devolução..."/>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Btn v="g" onClick={()=>setAjusteModal(null)}>Cancelar</Btn>
          <Btn v={ajuste.tipo==="ajuste_entrada"?"ok":"d"} onClick={salvarAjuste}><I.Check s={12}/> Confirmar</Btn>
        </div>
      </Mod>}
    </div>
  );
}


/* ─── GRÁFICO DE FLUXO DE CAIXA ───────────────────────────────────
   Dois painéis empilhados compartilhando o eixo X (nunca dois eixos Y
   na mesma escala): barras divergentes de entradas/saídas por período
   em cima, linha de saldo acumulado embaixo — cada um com sua própria
   escala, já que os valores têm ordens de grandeza diferentes.        */
function FluxoCaixaChart({dados}) {
  const [hover,setHover] = useState(null); // índice do dia em foco
  if (!dados || dados.length===0) return null;

  const W = 900, HBar = 150, HLine = 110, PAD_L = 52, PAD_R = 14, PAD_TOP = 10, GAP_PANELS = 28;
  const plotW = W - PAD_L - PAD_R;
  const n = dados.length;
  const slot = plotW / n;
  const barW = Math.max(3, Math.min(24, slot*0.55));

  const maiorFluxo = Math.max(1, ...dados.map(d=>Math.max(d.entradas,d.saidas)));
  const baselineY = PAD_TOP + HBar*0.55; // mais espaço para entradas (cima) do que saídas (baixo)
  const escalaBar = (HBar*0.42) / maiorFluxo;

  const minSaldo = Math.min(0, ...dados.map(d=>d.saldoAcumulado));
  const maxSaldo = Math.max(1, ...dados.map(d=>d.saldoAcumulado));
  const rangeSaldo = Math.max(1, maxSaldo-minSaldo);
  const lineTop = PAD_TOP + HBar + GAP_PANELS;
  const escalaLinha = (v) => lineTop + HLine - ((v-minSaldo)/rangeSaldo)*HLine;

  const x = (i) => PAD_L + slot*i + slot/2;
  const pontosLinha = dados.map((d,i)=>`${x(i)},${escalaLinha(d.saldoAcumulado)}`).join(" ");

  /* Rotula no máximo ~9 datas no eixo X para não amontoar */
  const passo = Math.max(1, Math.ceil(n/9));

  const totalH = lineTop + HLine + 26;

  return (
    <div style={{position:"relative"}}>
      <div style={{display:"flex",gap:16,marginBottom:10,fontSize:11}}>
        <span style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:10,height:10,borderRadius:2,background:C.success,display:"inline-block"}}/><span style={{color:C.muted}}>Entradas</span></span>
        <span style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:10,height:10,borderRadius:2,background:C.danger,display:"inline-block"}}/><span style={{color:C.muted}}>Saídas</span></span>
        <span style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:14,height:2,background:C.accent,display:"inline-block"}}/><span style={{color:C.muted}}>Saldo acumulado</span></span>
      </div>
      <svg viewBox={`0 0 ${W} ${totalH}`} style={{width:"100%",height:"auto",display:"block"}} role="img" aria-label="Gráfico de fluxo de caixa: entradas, saídas e saldo acumulado por dia">
        {/* linha de base do painel de barras */}
        <line x1={PAD_L} y1={baselineY} x2={W-PAD_R} y2={baselineY} stroke={C.border} strokeWidth={1}/>
        <text x={PAD_L-6} y={baselineY+3} textAnchor="end" fontSize="9" fill={C.muted}>R$ 0</text>

        {dados.map((d,i)=>{
          const cx = x(i);
          const hEntrada = d.entradas*escalaBar;
          const hSaida = d.saidas*escalaBar;
          const ativo = hover===i;
          return (
            <g key={d.data}>
              {/* área de hover cobre a coluna inteira (barras + linha) */}
              <rect x={PAD_L+slot*i} y={PAD_TOP} width={slot} height={HBar} fill="transparent"
                onMouseEnter={()=>setHover(i)} onMouseLeave={()=>setHover(h=>h===i?null:h)}/>
              {d.entradas>0 && <rect x={cx-barW/2} y={baselineY-hEntrada} width={barW} height={hEntrada} rx={4} fill={C.success} opacity={ativo?1:0.85}/>}
              {d.saidas>0 && <rect x={cx-barW/2} y={baselineY} width={barW} height={hSaida} rx={4} fill={C.danger} opacity={ativo?1:0.85}/>}
              {i%passo===0 && <text x={cx} y={PAD_TOP+HBar+13} textAnchor="middle" fontSize="9" fill={C.muted}>{fmtDate(d.data).slice(0,5)}</text>}
              {ativo && <line x1={cx} y1={PAD_TOP} x2={cx} y2={lineTop+HLine} stroke={C.accent} strokeWidth={1} strokeDasharray="2,2" opacity={0.4}/>}
            </g>
          );
        })}

        {/* painel do saldo acumulado */}
        <text x={PAD_L-6} y={escalaLinha(maxSaldo)+3} textAnchor="end" fontSize="9" fill={C.muted}>{fmt(maxSaldo)}</text>
        <text x={PAD_L-6} y={escalaLinha(minSaldo)+3} textAnchor="end" fontSize="9" fill={C.muted}>{fmt(minSaldo)}</text>
        <line x1={PAD_L} y1={escalaLinha(0)} x2={W-PAD_R} y2={escalaLinha(0)} stroke={C.border} strokeWidth={1} strokeDasharray="2,2"/>
        <polyline points={pontosLinha} fill="none" stroke={C.accent} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"/>
        {dados.map((d,i)=>(hover===i)&&
          <circle key={d.data} cx={x(i)} cy={escalaLinha(d.saldoAcumulado)} r={4} fill={C.accent} stroke={C.card} strokeWidth={2}/>
        )}
      </svg>

      {hover!=null && dados[hover] && (()=>{ const d=dados[hover]; const leftPct=(x(hover)/W)*100;
        return (
          <div style={{position:"absolute",top:4,left:`${leftPct}%`,transform:leftPct>70?"translateX(-100%)":leftPct<10?"none":"translateX(-50%)",background:C.text,color:"#FFFFFF",borderRadius:8,padding:"8px 11px",fontSize:11,pointerEvents:"none",boxShadow:"0 4px 14px #0003",whiteSpace:"nowrap",zIndex:5}}>
            <div style={{fontWeight:700,marginBottom:4}}>{fmtDate(d.data)}</div>
            <div style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:7,height:7,borderRadius:2,background:C.success,display:"inline-block"}}/>Entradas: <strong>{fmt(d.entradas)}</strong></div>
            <div style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:7,height:7,borderRadius:2,background:C.danger,display:"inline-block"}}/>Saídas: <strong>{fmt(d.saidas)}</strong></div>
            <div style={{display:"flex",alignItems:"center",gap:5,marginTop:2,paddingTop:4,borderTop:"1px solid #FFFFFF30"}}><span style={{width:9,height:2,background:C.accent,display:"inline-block"}}/>Saldo acumulado: <strong>{fmt(d.saldoAcumulado)}</strong></div>
          </div>
        );
      })()}
    </div>
  );
}

/* ─── FINANCEIRO ─────────────────────────────────────────────── */
function Financeiro({data,insert,update,user}) {
  const [aba,setAba]=useState("receber");
  const [subAbaReceber,setSubAbaReceber]=useState("aberto");
  const [subAbaPagar,setSubAbaPagar]=useState("aberto");
  const [modal,setModal]=useState(null);
  const [baixaModal,setBaixaModal]=useState(null);
  const [baixaConta,setBaixaConta]=useState("");
  const [filtR,setFiltR]=useState({paciente:"",de:"",ate:"",status:""});
  const [filtP,setFiltP]=useState({fornecedor:"",de:"",ate:"",status:"",recorrencia:""});
  const [filtM,setFiltM]=useState({conta:"",de:"",ate:""});
  const [filtFluxo,setFiltFluxo]=useState({de:"",ate:""});
  const [filtDRE,setFiltDRE]=useState(mesAtualRange());
  const [form,setForm]=useState({descricao:"",valor:0,vencimento:today(),data_competencia:today(),data_lancamento:today(),categoria_id:"",fornecedor:"",paciente:"",recorrente:false});
  const [caixaModal,setCaixaModal]=useState(null); // {tipo:'abrir'|'fechar', conta}
  const [caixaValor,setCaixaValor]=useState("");

  const categoriasReceita = (data.categorias_financeiras||[]).filter(c=>c.tipo==="receita"&&c.ativo!==false);
  const categoriasDespesa = (data.categorias_financeiras||[]).filter(c=>c.tipo==="despesa"&&c.ativo!==false);
  const nomeCategoria = (id) => (data.categorias_financeiras||[]).find(c=>c.id===Number(id))?.nome || "Sem categoria";

  const cr_lista=useMemo(()=>{
    let l=[...data.contas_receber];
    if(filtR.paciente){const b=filtR.paciente.toLowerCase();l=l.filter(c=>c.paciente?.toLowerCase().includes(b));}
    if(filtR.de) l=l.filter(c=>c.vencimento>=filtR.de);
    if(filtR.ate) l=l.filter(c=>c.vencimento<=filtR.ate);
    if(filtR.status) l=l.filter(c=>c.status===filtR.status);
    return l.sort((a,b)=>a.vencimento?.localeCompare(b.vencimento)||0);
  },[data.contas_receber,filtR]);

  const cp_lista=useMemo(()=>{
    let l=[...data.contas_pagar];
    if(filtP.fornecedor){const b=filtP.fornecedor.toLowerCase();l=l.filter(c=>c.fornecedor?.toLowerCase().includes(b)||c.descricao?.toLowerCase().includes(b));}
    if(filtP.de) l=l.filter(c=>c.vencimento>=filtP.de);
    if(filtP.ate) l=l.filter(c=>c.vencimento<=filtP.ate);
    if(filtP.status) l=l.filter(c=>c.status===filtP.status);
    if(filtP.recorrencia==="recorrente") l=l.filter(c=>c.recorrente);
    if(filtP.recorrencia==="pontual") l=l.filter(c=>!c.recorrente);
    return l.sort((a,b)=>a.vencimento?.localeCompare(b.vencimento)||0);
  },[data.contas_pagar,filtP]);

  const movs=useMemo(()=>{
    let l=[...data.movimentacoes];
    if(filtM.conta) l=l.filter(m=>String(m.conta_id)===filtM.conta);
    if(filtM.de) l=l.filter(m=>m.data>=filtM.de);
    if(filtM.ate) l=l.filter(m=>m.data<=filtM.ate);
    return l.sort((a,b)=>(b.data||"").localeCompare(a.data||""));
  },[data.movimentacoes,filtM]);

  // Saldos
  const saldos=data.contas_bancarias.map(c=>{const ms=data.movimentacoes.filter(m=>m.conta_id===c.id);const s=ms.reduce((acc,m)=>m.tipo==="entrada"?acc+Number(m.valor):acc-Number(m.valor),Number(c.saldo_inicial)||0);return{...c,saldo:s};});
  const cr_abertas = cr_lista.filter(c=>c.status==="aberto");
  const cr_recebidas = cr_lista.filter(c=>c.status==="quitado");
  const cp_abertas = cp_lista.filter(c=>c.status==="aberto");
  const cp_pagas = cp_lista.filter(c=>c.status==="quitado");
  const totalReceber=cr_abertas.reduce((s,c)=>s+(Number(c.valor)||0),0);
  const totalRecebido=cr_recebidas.reduce((s,c)=>s+(Number(c.valor)||0),0);
  const totalPagar=cp_abertas.reduce((s,c)=>s+(Number(c.valor)||0),0);
  const totalPago=cp_pagas.reduce((s,c)=>s+(Number(c.valor)||0),0);

  const handleBaixa=async(item,tipo)=>{
    if(!baixaConta){alert("Selecione a conta.");return;}
    const tabela=tipo==="receber"?"contas_receber":"contas_pagar";
    await update(tabela,item.id,{status:"quitado",conta_id:parseInt(baixaConta),data_baixa:today()});
    await insert("movimentacoes",{conta_id:parseInt(baixaConta),tipo:tipo==="receber"?"entrada":"saida",origem:tipo==="receber"?"contas_receber":"contas_pagar",origem_id:item.id,descricao:tipo==="receber"?`Recebimento — ${item.paciente||item.descricao}`:`Pagamento — ${item.descricao}`,valor:Number(item.valor)||0,data:today()});
    setBaixaModal(null);setBaixaConta("");
  };
  const abrirModalLancamento = (tipo) => {
    setForm({descricao:"",valor:0,vencimento:today(),data_competencia:today(),data_lancamento:today(),categoria_id:"",fornecedor:"",paciente:"",recorrente:false});
    setModal(tipo);
  };

  const cancelar=(id,tipo)=>{
    const tabela=tipo==="receber"?"contas_receber":"contas_pagar";
    update(tabela,id,{status:"cancelado"});
  };

  const statusColor={aberto:C.warn,quitado:C.success,cancelado:C.danger,vencido:C.danger};

  // ── FLUXO DE CAIXA: agrupa movimentações por dia, com saldo acumulado ──
  const saldoInicialTotal = data.contas_bancarias.reduce((s,c)=>s+(Number(c.saldo_inicial)||0),0);
  const fluxoDados = useMemo(()=>{
    let ms=[...data.movimentacoes];
    if(filtFluxo.de) ms=ms.filter(m=>m.data>=filtFluxo.de);
    if(filtFluxo.ate) ms=ms.filter(m=>m.data<=filtFluxo.ate);
    const porDia={};
    ms.forEach(m=>{
      if(!porDia[m.data]) porDia[m.data]={data:m.data,entradas:0,saidas:0};
      if(m.tipo==="entrada") porDia[m.data].entradas+=Number(m.valor)||0;
      else porDia[m.data].saidas+=Number(m.valor)||0;
    });
    /* Saldo acumulado parte do saldo inicial das contas + tudo que aconteceu ANTES do período filtrado */
    const antesDoPeriodo = filtFluxo.de ? data.movimentacoes.filter(m=>m.data<filtFluxo.de) : [];
    let acumulado = saldoInicialTotal + antesDoPeriodo.reduce((s,m)=>s+(m.tipo==="entrada"?Number(m.valor):-Number(m.valor)),0);
    const dias = Object.values(porDia).sort((a,b)=>a.data.localeCompare(b.data));
    return dias.map(d=>{ acumulado += d.entradas - d.saidas; return {...d, saldoAcumulado:acumulado}; });
  },[data.movimentacoes,filtFluxo,saldoInicialTotal]);
  const totalEntradasFluxo = fluxoDados.reduce((s,d)=>s+d.entradas,0);
  const totalSaidasFluxo = fluxoDados.reduce((s,d)=>s+d.saidas,0);

  // ── DRE — formato padrão de mercado (Receita Bruta → Deduções → Receita Líquida →
  //    Custos → Lucro Bruto → Despesas Operacionais → Resultado Operacional →
  //    Resultado Financeiro → LAIR → Impostos sobre o Lucro → Lucro Líquido) ──
  const dentroPeriodoDRE = (dataCompetencia, vencimentoFallback) => {
    const d = dataCompetencia || vencimentoFallback;
    if(!d) return false;
    if(filtDRE.de && d<filtDRE.de) return false;
    if(filtDRE.ate && d>filtDRE.ate) return false;
    return true;
  };
  const mapCategoriaParaContaDRE = (categoriaId) => (data.categorias_financeiras||[]).find(c=>c.id===categoriaId)?.conta_dre_id || null;
  const lancamentosDoGrupo = (grupoId) => grupoDRE(grupoId)?.tipo==="receita" ? data.contas_receber : data.contas_pagar;
  const linhasDoGrupo = (grupoId) => {
    const contas = (data.contas_dre||[]).filter(cd=>cd.grupo===grupoId && cd.ativo!==false).sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    const noPeriodo = lancamentosDoGrupo(grupoId).filter(c=>dentroPeriodoDRE(c.data_competencia,c.vencimento));
    return contas.map(conta=>({
      conta, valor: noPeriodo.filter(c=>mapCategoriaParaContaDRE(c.categoria_id)===conta.id).reduce((s,c)=>s+(Number(c.valor)||0),0),
    })).filter(l=>l.valor>0);
  };
  const somaLinhas = (linhas) => linhas.reduce((s,l)=>s+l.valor,0);

  // 1. Receita Operacional Bruta (+ receitas sem categoria vinculada a nenhuma conta do DRE)
  const dreReceitaBrutaLinhas = linhasDoGrupo("receita_bruta");
  const receitaNaoClassificada = data.contas_receber.filter(c=>dentroPeriodoDRE(c.data_competencia,c.vencimento)&&!mapCategoriaParaContaDRE(c.categoria_id)).reduce((s,c)=>s+(Number(c.valor)||0),0);
  if(receitaNaoClassificada>0) dreReceitaBrutaLinhas.push({conta:{id:"nc-r",nome:"Outras receitas (não classificadas)"}, valor:receitaNaoClassificada});
  const dreReceitaBruta = somaLinhas(dreReceitaBrutaLinhas);

  // 2. (-) Deduções da Receita → 3. Receita Operacional Líquida
  const dreDeducoesLinhas = linhasDoGrupo("deducoes");
  const dreDeducoes = somaLinhas(dreDeducoesLinhas);
  const dreReceitaLiquida = dreReceitaBruta - dreDeducoes;

  // 4. (-) Custo dos Serviços Prestados (categorizado manualmente + consumo automático de insumos) → 5. Lucro Bruto
  const dreCustosLinhas = linhasDoGrupo("custos");
  const dreCustoProdutos = data.atendimentos.reduce((s,at)=>{
    const itens=(data.atendimento_itens||[]).filter(i=>i.atendimento_id===at.id);
    if(itens.length>0){
      return s+itens.reduce((si,item)=>{
        if(item.tipo==="produto"){const prod=data.produtos.find(p=>p.id===item.produto_id);return si+(Number(prod?.custo_unitario)||0)*(Number(item.quantidade)||1);}
        if(item.tipo==="procedimento"){const proc=data.procedimentos.find(p=>p.id===item.procedimento_id);return si+(Number(proc?.custo_total)||0)*(Number(item.quantidade)||1);}
        return si;
      },0);
    }
    const proc=data.procedimentos.find(p=>p.id===at.procedimento_id||p.nome===at.servico);
    return s+(Number(proc?.custo_total)||0);
  },0);
  if(dreCustoProdutos>0) dreCustosLinhas.push({conta:{id:"auto-custo",nome:"Consumo de insumos em atendimentos"}, valor:dreCustoProdutos});
  const dreCustosTotal = somaLinhas(dreCustosLinhas);
  const dreLucroBruto = dreReceitaLiquida - dreCustosTotal;

  // 6. (-) Despesas Operacionais (comissões automáticas + categorizadas + não classificadas) → 7. Resultado Operacional
  const dreDespOperLinhas = linhasDoGrupo("despesas_operacionais");
  const dreComissoes = (data.comissoes||[]).reduce((s,c)=>s+(Number(c.valor_comissao)||0),0);
  if(dreComissoes>0) dreDespOperLinhas.push({conta:{id:"auto-comissao",nome:"Comissões de profissionais"}, valor:dreComissoes});
  const despesaNaoClassificada = data.contas_pagar.filter(c=>dentroPeriodoDRE(c.data_competencia,c.vencimento)&&!mapCategoriaParaContaDRE(c.categoria_id)).reduce((s,c)=>s+(Number(c.valor)||0),0);
  if(despesaNaoClassificada>0) dreDespOperLinhas.push({conta:{id:"nc-d",nome:"Outras despesas (não classificadas)"}, valor:despesaNaoClassificada});
  const dreDespOperTotal = somaLinhas(dreDespOperLinhas);
  const dreResultadoOperacional = dreLucroBruto - dreDespOperTotal;

  // 8. (+) Receitas Financeiras / (-) Despesas Financeiras → 9. Resultado Antes do IR/CSLL (LAIR)
  const dreReceitasFinLinhas = linhasDoGrupo("receitas_financeiras");
  const dreReceitasFin = somaLinhas(dreReceitasFinLinhas);
  const dreDespesasFinLinhas = linhasDoGrupo("despesas_financeiras");
  const dreDespesasFin = somaLinhas(dreDespesasFinLinhas);
  const dreLAIR = dreResultadoOperacional + dreReceitasFin - dreDespesasFin;

  // 10. (-) Impostos sobre o Lucro → 11. Lucro Líquido do Exercício
  const dreImpostosLucroLinhas = linhasDoGrupo("impostos_lucro");
  const dreImpostosLucro = somaLinhas(dreImpostosLucroLinhas);
  const dreResultado = dreLAIR - dreImpostosLucro;
  const dreReceita = dreReceitaBruta; // usado no rótulo da aba e na margem

  // ── CAIXA DO DIA ──
  const caixasHoje = (data.caixa_diario||[]).filter(c=>c.data===today());
  const caixaAberto = (contaId) => caixasHoje.find(c=>c.conta_id===contaId && c.status==="aberto");

  const calcularSaldoSistemaDoDia = (contaId, dataAbertura, valorAbertura) => {
    const movsHoje = data.movimentacoes.filter(m=>m.conta_id===contaId && m.data===dataAbertura);
    const entradas = movsHoje.filter(m=>m.tipo==="entrada").reduce((s,m)=>s+Number(m.valor),0);
    const saidas = movsHoje.filter(m=>m.tipo==="saida").reduce((s,m)=>s+Number(m.valor),0);
    return Number(valorAbertura) + entradas - saidas;
  };

  const abrirCaixa = async () => {
    if(!caixaModal) return;
    await insert("caixa_diario",{
      conta_id:caixaModal.conta.id, data:today(),
      valor_abertura:Number(caixaValor)||0,
      status:"aberto", aberto_por:user?.nome||"—",
    });
    setCaixaModal(null); setCaixaValor("");
  };

  const fecharCaixa = async () => {
    if(!caixaModal||!caixaModal.registro) return;
    const sistema = calcularSaldoSistemaDoDia(caixaModal.conta.id, caixaModal.registro.data, caixaModal.registro.valor_abertura);
    const informado = Number(caixaValor)||0;
    await update("caixa_diario", caixaModal.registro.id, {
      status:"fechado", valor_sistema:sistema, valor_informado:informado,
      diferenca: informado-sistema, fechado_por:user?.nome||"—",
      fechado_em:new Date().toISOString(),
    });
    setCaixaModal(null); setCaixaValor("");
  };

  const abas=[
    {id:"receber",label:"Contas a Receber",valor:fmt(totalReceber),cor:C.success},
    {id:"pagar",label:"Contas a Pagar",valor:fmt(totalPagar),cor:C.danger},
    {id:"caixadia",label:"Caixa do Dia",valor:`${caixasHoje.filter(c=>c.status==="aberto").length} aberto(s)`,cor:C.accent},
    {id:"fluxo",label:"Fluxo de Caixa",valor:fmt(totalEntradasFluxo-totalSaidasFluxo),cor:C.info},
    {id:"dre",label:"DRE Simplificado",valor:fmt(dreResultado),cor:dreResultado>=0?C.success:C.danger},
    {id:"extrato",label:"Extrato por Conta",valor:fmt(saldos.reduce((s,c)=>s+c.saldo,0)),cor:C.info},
  ];

  return(
    <div>
      <PH title="Financeiro" sub="Controle completo"/>
      <div style={{display:"flex",gap:7,marginBottom:16,flexWrap:"wrap"}}>
        {abas.map(a=><button key={a.id} onClick={()=>setAba(a.id)} style={{background:aba===a.id?C.card:C.surface,border:`1px solid ${aba===a.id?a.cor+"50":C.border}`,borderRadius:10,padding:"9px 14px",textAlign:"left",minWidth:105,boxShadow:aba===a.id?"0 2px 8px #7C5CBF0F":"none"}}>
          <div style={{color:C.muted,fontSize:10,marginBottom:2}}>{a.label}</div>
          <div style={{color:a.cor,fontSize:13,fontWeight:700}}>{a.valor}</div>
        </button>)}
      </div>

      {/* A RECEBER (com sub-abas Aberto / Recebidos) */}
      {aba==="receber"&&<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:11,flexWrap:"wrap",gap:8}}>
          <div style={{display:"flex",gap:7}}>
            {[["aberto","Em Aberto",cr_abertas.length,C.warn],["quitado","Recebidos",cr_recebidas.length,C.success]].map(([id,label,qtd,cor])=>(
              <button key={id} onClick={()=>setSubAbaReceber(id)} style={{padding:"6px 14px",borderRadius:8,border:`1px solid ${subAbaReceber===id?cor:C.border}`,background:subAbaReceber===id?cor+"14":"transparent",color:subAbaReceber===id?cor:C.muted,fontSize:11,fontWeight:subAbaReceber===id?700:400,cursor:"pointer"}}>{label} ({qtd})</button>
            ))}
          </div>
          <Btn onClick={()=>abrirModalLancamento("rec")}><I.Plus s={12}/> Lançar</Btn>
        </div>
        <FilterBar filters={[{key:"paciente",type:"text",label:"Buscar paciente..."},{key:"de",type:"date",label:"De"},{key:"ate",type:"date",label:"Até"}]} values={filtR} onChange={(k,v)=>setFiltR(p=>({...p,[k]:v}))}/>
        <ST cols={subAbaReceber==="aberto"?["Paciente","Descrição","Categoria","Vencimento","Valor","Forma Pgto","Status","Ações"]:["Paciente","Descrição","Recebido em","Valor","Forma Pgto","Conta"]}
          rows={(subAbaReceber==="aberto"?cr_abertas:cr_recebidas).map(c=>{
            if(subAbaReceber==="aberto") return [
              <span style={{fontWeight:600}}>{c.paciente||"—"}</span>,
              <span style={{fontSize:11}}>{c.descricao}</span>,
              <span style={{color:C.muted,fontSize:11}}>{c.categoria_id?nomeCategoria(c.categoria_id):"—"}</span>,
              <span style={{fontSize:11,color:c.vencimento<today()?C.danger:C.text}}>{fmtDate(c.vencimento)}</span>,
              <span style={{color:C.success,fontWeight:700}}>{fmt(c.valor)}</span>,
              <span style={{color:C.muted,fontSize:11}}>{c.forma_pagamento||"—"}</span>,
              <Badge text="Aberto" color={C.warn}/>,
              <div style={{display:"flex",gap:4}}>
                <Btn v="ok" onClick={()=>{setBaixaModal({...c,_tipo:"receber"});}} style={{padding:"3px 8px",fontSize:10}}>Receber</Btn>
                <Btn v="d" onClick={()=>cancelar(c.id,"receber")} style={{padding:"3px 7px"}}><I.X s={11}/></Btn>
              </div>
            ];
            const cont = data.contas_bancarias.find(cb=>cb.id===c.conta_id);
            return [
              <span style={{fontWeight:600}}>{c.paciente||"—"}</span>,
              <span style={{fontSize:11}}>{c.descricao}</span>,
              <span style={{fontSize:11}}>{fmtDate(c.data_baixa)}</span>,
              <span style={{color:C.success,fontWeight:700}}>{fmt(c.valor)}</span>,
              <span style={{color:C.muted,fontSize:11}}>{c.forma_pagamento||"—"}</span>,
              <span style={{fontSize:11}}>{cont?.nome||"—"}</span>,
            ];
          })}
          empty={subAbaReceber==="aberto"?"Nenhuma conta em aberto.":"Nenhum recebimento ainda."}
        />
      </>}

      {/* A PAGAR (com sub-abas Aberto / Pagas) */}
      {aba==="pagar"&&<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:11,flexWrap:"wrap",gap:8}}>
          <div style={{display:"flex",gap:7}}>
            {[["aberto","Em Aberto",cp_abertas.length,C.warn],["quitado","Pagas",cp_pagas.length,C.success]].map(([id,label,qtd,cor])=>(
              <button key={id} onClick={()=>setSubAbaPagar(id)} style={{padding:"6px 14px",borderRadius:8,border:`1px solid ${subAbaPagar===id?cor:C.border}`,background:subAbaPagar===id?cor+"14":"transparent",color:subAbaPagar===id?cor:C.muted,fontSize:11,fontWeight:subAbaPagar===id?700:400,cursor:"pointer"}}>{label} ({qtd})</button>
            ))}
          </div>
          <Btn onClick={()=>abrirModalLancamento("pag")}><I.Plus s={12}/> Lançar</Btn>
        </div>
        <FilterBar filters={[{key:"fornecedor",type:"text",label:"Buscar fornecedor/descrição..."},{key:"recorrencia",type:"select",label:"Tipo",options:[{value:"",label:"Todas"},{value:"recorrente",label:"Recorrentes"},{value:"pontual",label:"Pontuais"}]},{key:"de",type:"date",label:"De"},{key:"ate",type:"date",label:"Até"}]} values={filtP} onChange={(k,v)=>setFiltP(p=>({...p,[k]:v}))}/>
        <ST cols={subAbaPagar==="aberto"?["Fornecedor","Descrição","Categoria","Vencimento","Valor","Status","Ações"]:["Fornecedor","Descrição","Pago em","Valor","Conta"]}
          rows={(subAbaPagar==="aberto"?cp_abertas:cp_pagas).map(c=>{
            if(subAbaPagar==="aberto") return [
              <span style={{fontWeight:600}}>{c.fornecedor||"—"}</span>,
              <span style={{fontSize:11}}>{c.descricao}{c.recorrente&&<span style={{marginLeft:5,color:C.accent,fontSize:9,fontWeight:700}}>· RECORRENTE</span>}</span>,
              <span style={{color:C.muted,fontSize:11}}>{c.categoria_id?nomeCategoria(c.categoria_id):(c.categoria||"—")}</span>,
              <span style={{fontSize:11,color:c.vencimento<today()?C.danger:C.text}}>{fmtDate(c.vencimento)}</span>,
              <span style={{color:C.danger,fontWeight:700}}>{fmt(c.valor)}</span>,
              <Badge text="Aberto" color={C.warn}/>,
              <div style={{display:"flex",gap:4}}>
                <Btn v="ok" onClick={()=>{setBaixaModal({...c,_tipo:"pagar"});}} style={{padding:"3px 8px",fontSize:10}}>Pagar</Btn>
                <Btn v="d" onClick={()=>cancelar(c.id,"pagar")} style={{padding:"3px 7px"}}><I.X s={11}/></Btn>
              </div>
            ];
            const cont = data.contas_bancarias.find(cb=>cb.id===c.conta_id);
            return [
              <span style={{fontWeight:600}}>{c.fornecedor||"—"}</span>,
              <span style={{fontSize:11}}>{c.descricao}</span>,
              <span style={{fontSize:11}}>{fmtDate(c.data_baixa)}</span>,
              <span style={{color:C.danger,fontWeight:700}}>{fmt(c.valor)}</span>,
              <span style={{fontSize:11}}>{cont?.nome||"—"}</span>,
            ];
          })}
          empty={subAbaPagar==="aberto"?"Nenhuma conta em aberto.":"Nenhum pagamento ainda."}
        />
      </>}

      {/* CAIXA DO DIA */}
      {aba==="caixadia"&&<>
        <div style={{background:C.info+"10",border:`1px solid ${C.info}25`,borderRadius:9,padding:"10px 13px",marginBottom:14,display:"flex",gap:8,alignItems:"center"}}>
          <I.Warn c={C.info} s={14}/>
          <span style={{color:C.info,fontSize:12}}>Abra o caixa no início do turno e feche ao final do dia para conferir o valor contado com o que o sistema calculou (conciliação).</span>
        </div>
        <div className="g1" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          {data.contas_bancarias.filter(c=>c.tipo==="caixa"||c.tipo==="caixa_master").map(conta=>{
            const registro = caixaAberto(conta.id);
            const fechadosHoje = caixasHoje.filter(c=>c.conta_id===conta.id && c.status==="fechado");
            return(
              <div key={conta.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:13,padding:15}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div>
                    <div style={{color:C.text,fontWeight:700,fontSize:13}}>{conta.nome}</div>
                    <div style={{color:C.muted,fontSize:10}}>{conta.tipo==="caixa_master"?"Caixa Master (administrativo)":"Caixa de atendimentos"}</div>
                  </div>
                  <Badge text={registro?"Aberto":"Fechado"} color={registro?C.success:C.muted}/>
                </div>
                {registro
                  ? <>
                      <div style={{background:C.surface,borderRadius:8,padding:"9px 11px",marginBottom:10}}>
                        <div style={{color:C.muted,fontSize:10,marginBottom:2}}>Valor de abertura hoje</div>
                        <div style={{color:C.text,fontWeight:700,fontSize:15}}>{fmt(registro.valor_abertura)}</div>
                        <div style={{color:C.muted,fontSize:10,marginTop:3}}>Aberto por {registro.aberto_por}</div>
                      </div>
                      <Btn v="warn" onClick={()=>setCaixaModal({tipo:"fechar",conta,registro})} style={{width:"100%",justifyContent:"center"}}><I.Lock s={12}/> Fechar Caixa</Btn>
                    </>
                  : <Btn onClick={()=>setCaixaModal({tipo:"abrir",conta})} style={{width:"100%",justifyContent:"center"}}><I.Cal s={12}/> Abrir Caixa</Btn>
                }
                {fechadosHoje.length>0&&<div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${C.border}`}}>
                  <div style={{color:C.muted,fontSize:10,marginBottom:5}}>Fechamentos de hoje</div>
                  {fechadosHoje.map(f=>(
                    <div key={f.id} style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}>
                      <span style={{color:C.muted}}>Sistema: {fmt(f.valor_sistema)} · Contado: {fmt(f.valor_informado)}</span>
                      <span style={{color:Math.abs(f.diferenca)<0.01?C.success:C.danger,fontWeight:700}}>{f.diferenca>=0?"+":""}{fmt(f.diferenca)}</span>
                    </div>
                  ))}
                </div>}
              </div>
            );
          })}
        </div>
        {data.contas_bancarias.filter(c=>c.tipo==="caixa"||c.tipo==="caixa_master").length===0&&
          <p style={{color:C.muted,fontSize:13,textAlign:"center",padding:24}}>Nenhuma conta do tipo "Caixa" cadastrada. Vá em Cadastros → Contas e Caixa para criar uma.</p>
        }
      </>}

      {/* FLUXO DE CAIXA */}
      {aba==="fluxo"&&<>
        <div className="stat-row" style={{display:"flex",gap:9,marginBottom:14,flexWrap:"wrap"}}>
          <SC label="Total Entradas" value={fmt(totalEntradasFluxo)} Icon={I.Up} color={C.success}/>
          <SC label="Total Saídas" value={fmt(totalSaidasFluxo)} Icon={I.Dollar} color={C.danger}/>
          <SC label="Saldo do Período" value={fmt(totalEntradasFluxo-totalSaidasFluxo)} Icon={I.Sparkle} color={totalEntradasFluxo-totalSaidasFluxo>=0?C.success:C.danger}/>
        </div>
        <FilterBar filters={[{key:"de",type:"date",label:"De"},{key:"ate",type:"date",label:"Até"}]} values={filtFluxo} onChange={(k,v)=>setFiltFluxo(p=>({...p,[k]:v}))}/>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:13,padding:16}}>
          {fluxoDados.length===0
            ? <p style={{color:C.muted,fontSize:13,textAlign:"center",padding:20}}>Nenhuma movimentação no período.</p>
            : <FluxoCaixaChart dados={fluxoDados}/>
          }
        </div>
      </>}

      {/* DRE — formato padrão de mercado, regime de competência */}
      {aba==="dre"&&<>
        <FilterBar filters={[{key:"de",type:"date",label:"De"},{key:"ate",type:"date",label:"Até"}]} values={filtDRE} onChange={(k,v)=>setFiltDRE(p=>({...p,[k]:v}))}/>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:13,padding:20,maxWidth:640}}>
          <h3 style={{color:C.text,fontSize:14,fontWeight:700,marginBottom:4}}>Demonstrativo de Resultado do Exercício (DRE)</h3>
          <p style={{color:C.muted,fontSize:11,marginBottom:16}}>Regime de competência. As contas de cada grupo vêm de "Cadastros → Categorias → Contas do DRE".</p>

          {[
            {titulo:"Receita Operacional Bruta", linhas:dreReceitaBrutaLinhas, subtotalLabel:null, cor:C.success},
            {titulo:"(–) Deduções da Receita", linhas:dreDeducoesLinhas, subtotalLabel:"(=) Receita Operacional Líquida", subtotal:dreReceitaLiquida, cor:C.danger},
            {titulo:"(–) Custo dos Serviços Prestados", linhas:dreCustosLinhas, subtotalLabel:"(=) Lucro Bruto", subtotal:dreLucroBruto, cor:C.danger},
            {titulo:"(–) Despesas Operacionais", linhas:dreDespOperLinhas, subtotalLabel:"(=) Resultado Operacional (EBIT)", subtotal:dreResultadoOperacional, cor:C.danger},
            {titulo:"(+) Receitas Financeiras", linhas:dreReceitasFinLinhas, subtotalLabel:null, cor:C.success},
            {titulo:"(–) Despesas Financeiras", linhas:dreDespesasFinLinhas, subtotalLabel:"(=) Resultado Antes do IR/CSLL", subtotal:dreLAIR, cor:C.danger},
            {titulo:"(–) Impostos sobre o Lucro (IR/CSLL)", linhas:dreImpostosLucroLinhas, subtotalLabel:null, cor:C.danger},
          ].map((secao,i)=>(
            <div key={i}>
              <div style={{color:C.muted,fontSize:10,fontWeight:700,letterSpacing:.6,textTransform:"uppercase",margin:i===0?"0 0 4px":"16px 0 4px"}}>{secao.titulo}</div>
              {secao.linhas.length===0 && <div style={{color:C.muted,fontSize:12,padding:"4px 0 4px 12px"}}>Nada lançado no período.</div>}
              {secao.linhas.map(l=>(
                <div key={l.conta.id} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.border}`,paddingLeft:12}}>
                  <span style={{color:C.text,fontSize:13}}>{l.conta.nome}</span>
                  <span style={{color:secao.cor,fontWeight:600,fontSize:13}}>{fmt(l.valor)}</span>
                </div>
              ))}
              {secao.subtotalLabel&&<div style={{display:"flex",justifyContent:"space-between",padding:"7px 0",marginTop:2,fontWeight:700,borderTop:`1px solid ${C.border}`}}>
                <span style={{color:C.text,fontSize:13}}>{secao.subtotalLabel}</span>
                <span style={{color:secao.subtotal>=0?C.success:C.danger,fontSize:13}}>{fmt(secao.subtotal)}</span>
              </div>}
            </div>
          ))}

          <div style={{display:"flex",justifyContent:"space-between",padding:"14px 0 4px",marginTop:10,borderTop:`2px solid ${C.text}`}}>
            <span style={{color:C.text,fontSize:15,fontWeight:700}}>Lucro Líquido do Exercício</span>
            <span style={{color:dreResultado>=0?C.success:C.danger,fontWeight:700,fontSize:18}}>{fmt(dreResultado)}</span>
          </div>
          <div style={{color:C.muted,fontSize:11,marginTop:4}}>Margem bruta: {dreReceitaLiquida>0?Math.round(dreLucroBruto/dreReceitaLiquida*100):0}% · Margem líquida: {dreReceitaBruta>0?Math.round(dreResultado/dreReceitaBruta*100):0}%</div>
        </div>
      </>}

      {/* EXTRATO */}
      {aba==="extrato"&&<>
        <div className="stat-row" style={{display:"flex",gap:9,marginBottom:13,flexWrap:"wrap"}}>
          {saldos.map(c=><SC key={c.id} label={c.nome} value={fmt(c.saldo)} Icon={c.tipo==="conta_corrente"?I.Bank:I.Dollar} color={c.saldo>=0?C.success:C.danger} sub={c.tipo==="caixa_master"?"Caixa Master":c.tipo==="caixa"?"Caixa":"Conta Corrente"}/>)}
        </div>
        <FilterBar filters={[{key:"conta",type:"select",label:"Conta",options:data.contas_bancarias.map(c=>({value:String(c.id),label:c.nome}))},{key:"de",type:"date",label:"De"},{key:"ate",type:"date",label:"Até"}]} values={filtM} onChange={(k,v)=>setFiltM(p=>({...p,[k]:v}))}/>
        <ST cols={["Data","Conta","Tipo","Descrição","Valor","Saldo"]}
          rows={movs.map(m=>{const cont=data.contas_bancarias.find(c=>c.id===m.conta_id);return[
            fmtDate(m.data),<span style={{fontSize:11}}>{cont?.nome||"—"}</span>,
            <Badge text={m.tipo} color={m.tipo==="entrada"?C.success:C.danger}/>,
            <span style={{fontSize:12}}>{m.descricao}</span>,
            <span style={{color:m.tipo==="entrada"?C.success:C.danger,fontWeight:700}}>{m.tipo==="entrada"?"+":"-"}{fmt(m.valor)}</span>,
            <span style={{fontWeight:600,fontSize:11}}>{m.saldo_atual?fmt(m.saldo_atual):"—"}</span>
          ];})}
        />
      </>}

      {/* MODAL LANÇAMENTO */}
      {modal&&<Mod title={modal==="rec"?"Nova Conta a Receber":"Nova Conta a Pagar"} onClose={()=>setModal(null)}>
        <Inp label="Descrição" value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))}/>
        <Inp label="Valor (R$)" type="number" value={form.valor} onChange={e=>setForm(f=>({...f,valor:e.target.value}))}/>
        {modal==="pag"&&<Inp label="Fornecedor" value={form.fornecedor} onChange={e=>setForm(f=>({...f,fornecedor:e.target.value}))}/>}
        {modal==="rec"&&<Inp label="Paciente" value={form.paciente} onChange={e=>setForm(f=>({...f,paciente:e.target.value}))}/>}
        <Sel label="Categoria" value={form.categoria_id} onChange={e=>setForm(f=>({...f,categoria_id:e.target.value}))}
          options={[{value:"",label:"Selecione..."}, ...(modal==="rec"?categoriasReceita:categoriasDespesa).map(c=>({value:c.id,label:c.nome}))]}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Inp label="Vencimento" type="date" value={form.vencimento} onChange={e=>setForm(f=>({...f,vencimento:e.target.value}))}/>
          <Inp label="Data de Competência" type="date" value={form.data_competencia} onChange={e=>setForm(f=>({...f,data_competencia:e.target.value}))}/>
        </div>
        <Inp label="Data de Lançamento" type="date" value={form.data_lancamento} onChange={e=>setForm(f=>({...f,data_lancamento:e.target.value}))}/>
        <p style={{color:C.muted,fontSize:10,marginTop:-6,marginBottom:10}}>Por padrão é hoje — mude para uma data passada se estiver registrando algo retroativo.</p>
        {modal==="pag"&&<label style={{display:"flex",alignItems:"center",gap:8,marginTop:2,cursor:"pointer"}}>
          <input type="checkbox" checked={!!form.recorrente} onChange={e=>setForm(f=>({...f,recorrente:e.target.checked}))}/>
          <span style={{color:C.text,fontSize:12}}>Despesa recorrente (fixa, se repete todo mês)</span>
        </label>}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:14}}>
          <Btn v="g" onClick={()=>setModal(null)}>Cancelar</Btn>
          <Btn onClick={async()=>{
            const v=Number(form.valor);
            const base={descricao:form.descricao,valor:v,vencimento:form.vencimento,data_lancamento:form.data_lancamento||today(),data_competencia:form.data_competencia||form.vencimento,categoria_id:form.categoria_id?Number(form.categoria_id):null,status:"aberto"};
            if(modal==="rec")await insert("contas_receber",{...base,paciente:form.paciente});
            if(modal==="pag")await insert("contas_pagar",{...base,fornecedor:form.fornecedor,recorrente:!!form.recorrente});
            setModal(null);
          }}><I.Check s={12}/> Salvar</Btn>
        </div>
      </Mod>}

      {/* MODAL BAIXA */}
      {baixaModal&&<Mod title={`Baixar — ${baixaModal.descricao}`} onClose={()=>{setBaixaModal(null);setBaixaConta("");}}>
        <div style={{background:C.surface,borderRadius:9,padding:12,marginBottom:13}}>
          <div style={{color:C.muted,fontSize:11,marginBottom:3}}>{baixaModal._tipo==="receber"?"Recebimento de:":"Pagamento de:"}</div>
          <div style={{color:C.text,fontWeight:700,fontSize:16}}>{fmt(baixaModal.valor)}</div>
          <div style={{color:C.muted,fontSize:11,marginTop:2}}>{baixaModal.descricao}</div>
        </div>
        <Sel label="Conta de destino (onde o dinheiro vai/saiu)" value={baixaConta} onChange={e=>setBaixaConta(e.target.value)} options={[{value:"",label:"Selecione a conta..."}, ...data.contas_bancarias.map(c=>({value:c.id,label:`${c.nome} (${c.tipo}) — Saldo: ${fmt(saldos.find(s=>s.id===c.id)?.saldo||0)}`}))]}/>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Btn v="g" onClick={()=>{setBaixaModal(null);setBaixaConta("");}}>Cancelar</Btn>
          <Btn v="ok" onClick={()=>handleBaixa(baixaModal,baixaModal._tipo)} disabled={!baixaConta}><I.Check s={12}/> Confirmar Baixa</Btn>
        </div>
      </Mod>}

      {/* MODAL ABRIR/FECHAR CAIXA */}
      {caixaModal&&<Mod title={caixaModal.tipo==="abrir"?`Abrir Caixa — ${caixaModal.conta.nome}`:`Fechar Caixa — ${caixaModal.conta.nome}`} onClose={()=>{setCaixaModal(null);setCaixaValor("");}}>
        {caixaModal.tipo==="abrir"
          ? <>
              <p style={{color:C.muted,fontSize:12,marginBottom:12}}>Informe o valor em dinheiro que está no caixa no início do turno.</p>
              <Inp label="Valor de abertura (R$)" type="number" value={caixaValor} onChange={e=>setCaixaValor(e.target.value)} placeholder="0,00"/>
              <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}>
                <Btn v="g" onClick={()=>{setCaixaModal(null);setCaixaValor("");}}>Cancelar</Btn>
                <Btn onClick={abrirCaixa}><I.Check s={12}/> Abrir Caixa</Btn>
              </div>
            </>
          : <>
              {(()=>{const sistema=calcularSaldoSistemaDoDia(caixaModal.conta.id,caixaModal.registro.data,caixaModal.registro.valor_abertura);return(
                <div style={{background:C.surface,borderRadius:9,padding:12,marginBottom:13}}>
                  <div style={{color:C.muted,fontSize:11,marginBottom:3}}>Valor esperado pelo sistema (abertura + entradas − saídas de hoje):</div>
                  <div style={{color:C.text,fontWeight:700,fontSize:18}}>{fmt(sistema)}</div>
                </div>
              );})()}
              <Inp label="Valor contado fisicamente (R$)" type="number" value={caixaValor} onChange={e=>setCaixaValor(e.target.value)} placeholder="0,00"/>
              {caixaValor!==""&&(()=>{const sistema=calcularSaldoSistemaDoDia(caixaModal.conta.id,caixaModal.registro.data,caixaModal.registro.valor_abertura);const dif=Number(caixaValor)-sistema;return(
                <div style={{background:Math.abs(dif)<0.01?C.success+"14":C.danger+"14",border:`1px solid ${Math.abs(dif)<0.01?C.success:C.danger}30`,borderRadius:8,padding:"9px 12px",marginTop:4,marginBottom:8}}>
                  <span style={{color:Math.abs(dif)<0.01?C.success:C.danger,fontSize:12,fontWeight:600}}>
                    {Math.abs(dif)<0.01?"✓ Caixa bate certinho!":dif>0?`Sobra de ${fmt(dif)}`:`Falta de ${fmt(Math.abs(dif))}`}
                  </span>
                </div>
              );})()}
              <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}>
                <Btn v="g" onClick={()=>{setCaixaModal(null);setCaixaValor("");}}>Cancelar</Btn>
                <Btn v="warn" onClick={fecharCaixa} disabled={caixaValor===""}><I.Lock s={12}/> Confirmar Fechamento</Btn>
              </div>
            </>
        }
      </Mod>}
    </div>
  );
}



/* ─── CUSTOS & PRECIFICAÇÃO ──────────────────────────────────── */
function Precos({data, update}) {
  const [filt, setFilt] = useState({busca:"", tipo:""});
  const [editMode, setEditMode] = useState(false);
  const [editValues, setEditValues] = useState({});
  const ff = (k,v) => setFilt(p=>({...p,[k]:v}));

  const tf = (data.contas_pagar||[]).filter(c=>c.recorrente).reduce((s,d)=>s+(Number(d.valor)||0),0);
  const tv = (data.contas_pagar||[]).filter(c=>!c.recorrente).reduce((s,d)=>s+(Number(d.valor)||0),0);
  const nA = data.atendimentos.length || 1;
  const cpA = (tf+tv)/nA;

  // Grid unificado: procedimentos + produtos
  const itens = useMemo(() => {
    const procs = data.procedimentos.filter(p=>p.ativo).map(p=>({
      id:`proc_${p.id}`, _id:p.id, _tipo:"procedimento",
      nome:p.nome, categoria:p.categoria,
      custo_insumos:Number(p.custo_insumos)||0,
      custo_fixo:Number(p.custo_fixo)||0,
      custo_total:Number(p.custo_total)||0,
      markup:Number(p.markup)||0,
      preco:Number(p.preco_venda)||0,
      margem:Number(p.margem)||0,
    }));
    const prods = data.produtos.filter(p=>p.ativo).map(p=>({
      id:`prod_${p.id}`, _id:p.id, _tipo:"produto",
      nome:p.nome, categoria:p.categoria,
      custo_insumos:Number(p.custo_unitario)||0,
      custo_fixo:0,
      custo_total:Number(p.custo_unitario)||0,
      markup:Number(p.markup)||0,
      preco:Number(p.preco_venda)||0,
      margem:Number(p.preco_venda)>0?Math.round(((Number(p.preco_venda)-Number(p.custo_unitario))/Number(p.preco_venda))*100):0,
    }));
    let lista = [...procs, ...prods];
    if(filt.busca) lista = lista.filter(i=>i.nome.toLowerCase().includes(filt.busca.toLowerCase())||i.categoria?.toLowerCase().includes(filt.busca.toLowerCase()));
    if(filt.tipo) lista = lista.filter(i=>i._tipo===filt.tipo);
    return lista;
  }, [data.procedimentos, data.produtos, filt]);

  // Inicializar valores de edição
  const startEdit = () => {
    const vals = {};
    itens.forEach(i=>{ vals[i.id] = {preco:i.preco, markup:i.markup}; });
    setEditValues(vals);
    setEditMode(true);
  };

  const calcMargem = (preco, custo) => preco>0 ? Math.round((preco-custo)/preco*100) : 0;

  const updatePreco = (id, k, v) => {
    setEditValues(prev => {
      const item = itens.find(i=>i.id===id);
      const updated = {...prev[id],[k]:v};
      if(k==="markup") {
        const novoPreco = item.custo_total*(1+(Number(v)||0)/100);
        updated.preco = novoPreco.toFixed(2);
      }
      if(k==="preco") {
        const mk = item.custo_total>0?((Number(v)-item.custo_total)/item.custo_total*100):0;
        updated.markup = mk.toFixed(1);
      }
      return {...prev,[id]:updated};
    });
  };

  const salvarItem = async (item) => {
    const vals = editValues[item.id];
    if(!vals) return;
    const preco = Number(vals.preco)||0;
    const markup = Number(vals.markup)||0;
    const margem = calcMargem(preco, item.custo_total);
    if(item._tipo==="procedimento") {
      await update("procedimentos", item._id, {preco_venda:preco, markup, margem});
    } else {
      await update("produtos", item._id, {preco_venda:preco, markup});
    }
  };

  const salvarTodos = async () => {
    for(const item of itens) { await salvarItem(item); }
    setEditMode(false);
  };

  return (
    <div>
      <PH title="Custos & Precificação" sub="Análise e formação de preço">
        {editMode
          ? <><Btn v="d" onClick={()=>setEditMode(false)}><I.X s={12}/> Cancelar</Btn><Btn v="ok" onClick={salvarTodos}><I.Check s={12}/> Salvar Todos</Btn></>
          : <Btn onClick={startEdit}><I.Edit s={12}/> Editar Preços</Btn>
        }
      </PH>

      <div className="stat-row" style={{display:"flex",gap:9,marginBottom:14,flexWrap:"wrap"}}>
        <SC label="Total Despesas" value={fmt(tf+tv)} Icon={I.Dollar} color={C.danger}/>
        <SC label="Custo/Atend." value={fmt(cpA)} Icon={I.Tag} color={C.purple} sub="Overhead médio"/>
        <SC label="Procedimentos" value={data.procedimentos.filter(p=>p.ativo).length} Icon={I.Scissors} color={C.accent}/>
        <SC label="Produtos" value={data.produtos.filter(p=>p.ativo).length} Icon={I.Box} color={C.info}/>
      </div>

      <FilterBar
        filters={[
          {key:"busca",type:"text",label:"Buscar por nome ou categoria..."},
          {key:"tipo",type:"select",label:"Tipo",options:[{value:"procedimento",label:"Procedimentos"},{value:"produto",label:"Produtos"}]},
        ]}
        values={filt} onChange={ff}
      />

      {editMode&&<div style={{background:C.info+"12",border:`1px solid ${C.info}30`,borderRadius:9,padding:"9px 13px",marginBottom:12,display:"flex",gap:8,alignItems:"center"}}>
        <I.Edit c={C.info} s={14}/><span style={{color:C.info,fontSize:12}}>Modo edição ativo — altere preços ou markup linha a linha e clique em <strong>Atualizar</strong>, ou clique em <strong>Salvar Todos</strong>.</span>
      </div>}

      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:13,overflow:"hidden"}}>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:700}}>
            <thead><tr style={{background:C.surface}}>
              {["Nome","Tipo","Categoria","Custo Insumos","Overhead","Custo Total","Markup %","Preço Venda","Margem",""].map(h=>(
                <th key={h} style={{padding:"9px 12px",textAlign:"left",color:C.muted,fontSize:10,textTransform:"uppercase",letterSpacing:.8,fontWeight:600,whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {itens.length===0&&<tr><td colSpan={10} style={{padding:24,textAlign:"center",color:C.muted,fontSize:13}}>Nenhum item encontrado.</td></tr>}
              {itens.map(item=>{
                const vals = editValues[item.id]||{preco:item.preco,markup:item.markup};
                const margem = editMode ? calcMargem(Number(vals.preco),item.custo_total) : item.margem;
                const corM = margem>60?C.success:margem>35?C.warn:C.danger;
                return (
                  <tr key={item.id} style={{borderTop:`1px solid ${C.border}`}}>
                    <td style={{padding:"9px 12px"}}><span style={{fontWeight:600,color:C.text,fontSize:12}}>{item.nome}</span></td>
                    <td style={{padding:"9px 12px"}}><Badge text={item._tipo} color={item._tipo==="procedimento"?C.accent:C.info}/></td>
                    <td style={{padding:"9px 12px",color:C.muted,fontSize:11}}>{item.categoria||"—"}</td>
                    <td style={{padding:"9px 12px",color:C.danger,fontSize:11,fontWeight:600}}>{fmt(item.custo_insumos)}</td>
                    <td style={{padding:"9px 12px",color:C.warn,fontSize:11}}>{fmt(item.custo_fixo)}</td>
                    <td style={{padding:"9px 12px",color:C.danger,fontWeight:700}}>{fmt(item.custo_total)}</td>
                    <td style={{padding:"9px 12px"}}>
                      {editMode
                        ? <input type="number" value={vals.markup} onChange={e=>updatePreco(item.id,"markup",e.target.value)} style={{width:70,background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"4px 6px",color:C.text,fontSize:12}}/>
                        : <span style={{color:C.info,fontWeight:600}}>{fmtN(item.markup)}%</span>
                      }
                    </td>
                    <td style={{padding:"9px 12px"}}>
                      {editMode
                        ? <input type="number" value={vals.preco} onChange={e=>updatePreco(item.id,"preco",e.target.value)} style={{width:90,background:C.accentSoft,border:`1px solid ${C.accent}`,borderRadius:6,padding:"4px 6px",color:C.accent,fontSize:12,fontWeight:700}}/>
                        : <span style={{color:C.success,fontWeight:700}}>{fmt(item.preco)}</span>
                      }
                    </td>
                    <td style={{padding:"9px 12px"}}><Badge text={`${margem}%`} color={corM}/></td>
                    <td style={{padding:"9px 12px"}}>
                      {editMode&&<Btn v="ok" onClick={()=>salvarItem(item)} style={{padding:"3px 9px",fontSize:10}}><I.Check s={11}/> Atualizar</Btn>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


/* ─── RELATÓRIOS & CRM ───────────────────────────────────────── */
function Relatorios({data, insert}) {
  const [aba, setAba] = useState("financeiro");
  const [filt, setFilt] = useState({de:"", ate:"", profissional:"", procedimento:""});
  const ff = (k,v) => setFilt(p=>({...p,[k]:v}));
  const [campModal, setCampModal] = useState(false);
  const [campForm, setCampForm] = useState({nome:"",tipo:"whatsapp",assunto:"",mensagem:"",segmento:""});
  const [msgEnviando, setMsgEnviando] = useState(false);
  const [msgStatus, setMsgStatus] = useState("");

  // Dados filtrados
  const atsFilt = useMemo(() => {
    let l = [...data.atendimentos];
    if(filt.de) l=l.filter(a=>a.data>=filt.de);
    if(filt.ate) l=l.filter(a=>a.data<=filt.ate);
    if(filt.profissional) l=l.filter(a=>String(a.profissional_id)===filt.profissional);
    if(filt.procedimento) l=l.filter(a=>String(a.procedimento_id)===filt.procedimento);
    return l;
  },[data.atendimentos,filt]);

  // KPIs financeiros
  const rec = atsFilt.reduce((s,a)=>s+(Number(a.valor_final||a.valor)||0),0);
  const despRelFiltradas = (data.contas_pagar||[]).filter(c=>c.status!=="cancelado"&&(!filt.de||c.vencimento>=filt.de)&&(!filt.ate||c.vencimento<=filt.ate));
  const tf = despRelFiltradas.filter(c=>c.recorrente).reduce((s,d)=>s+(Number(d.valor)||0),0);
  const tv = despRelFiltradas.filter(c=>!c.recorrente).reduce((s,d)=>s+(Number(d.valor)||0),0);
  const lucro = rec-tf-tv;
  const ticket = atsFilt.length>0?rec/atsFilt.length:0;
  const txConversao = data.agendamentos.length>0?(data.atendimentos.length/data.agendamentos.length*100).toFixed(1):0;

  // Por profissional
  const porProf = data.profissionais.map(p=>{
    const ats=atsFilt.filter(a=>a.profissional_id===p.id);
    const r=ats.reduce((s,a)=>s+(Number(a.valor_final||a.valor)||0),0);
    const c=p.tipo==="percentual"?r*(Number(p.percentual)||0)/100:(Number(p.salario)||0);
    return{...p,receita:r,custo:c,resultado:r-c,atend:ats.length,ticket:ats.length>0?r/ats.length:0};
  }).sort((a,b)=>b.receita-a.receita);

  // Por procedimento
  const porProc = data.procedimentos.map(p=>{
    const ats=atsFilt.filter(a=>a.procedimento_id===p.id||a.servico===p.nome);
    const r=ats.reduce((s,a)=>s+(Number(a.valor_final||a.valor)||0),0);
    return{...p,realizados:ats.length,receita:r};
  }).sort((a,b)=>b.receita-a.receita);

  // CRM — análise de clientes
  const crmPacientes = data.pacientes.map(p=>{
    const ats=data.atendimentos.filter(a=>a.paciente_id===p.id||a.paciente===p.nome);
    const total=ats.reduce((s,a)=>s+(Number(a.valor_final||a.valor)||0),0);
    const ultima=ats.sort((a,b)=>b.data?.localeCompare(a.data||"")||0)[0]?.data||null;
    const diasSemVir=ultima?Math.floor((new Date()-new Date(ultima))/(1000*60*60*24)):999;
    const freq=ats.length;
    const segmento=total>3000?"vip":total>1000?"regular":freq===0?"inativo":"novo";
    return{...p,total_real:total,ultima_visita_real:ultima,dias_sem_vir:diasSemVir,freq,segmento};
  }).sort((a,b)=>b.total_real-a.total_real);

  // Segmentação
  const segs = {
    vip: crmPacientes.filter(p=>p.segmento==="vip"),
    regular: crmPacientes.filter(p=>p.segmento==="regular"),
    novo: crmPacientes.filter(p=>p.segmento==="novo"),
    inativo: crmPacientes.filter(p=>p.segmento==="inativo"),
    reengajamento: crmPacientes.filter(p=>p.dias_sem_vir>=60&&p.freq>0),
  };

  // Forma de pagamento
  const porFp = {};
  atsFilt.forEach(a=>{const k=a.forma_pagamento||"Não informado";porFp[k]=(porFp[k]||0)+Number(a.valor_final||a.valor||0);});
  const fpList=Object.entries(porFp).sort((a,b)=>b[1]-a[1]);

  // Export Excel
  /* Evita injeção de fórmula (CSV/DDE) ao abrir o arquivo no Excel */
  const csvSafe = v => { const s=String(v??""); return /^[=+\-@]/.test(s) ? `'${s}` : s; };
  const exportExcel = (tipo) => {
    let csv="";
    if(tipo==="financeiro"){
      csv="Métrica;Valor\n";
      csv+=`Receita;${fmt(rec)}\nDespesas;${fmt(tf+tv)}\nLucro;${fmt(lucro)}\nMargem;${rec>0?Math.round(lucro/rec*100):0}%\nTicket Médio;${fmt(ticket)}\nAtendimentos;${atsFilt.length}\nTaxa Conversão;${txConversao}%\n`;
    }
    if(tipo==="crm"){
      csv="Nome;CPF;WhatsApp;Email;Total Gasto;Visitas;Última Visita;Dias Sem Vir;Segmento\n";
      crmPacientes.forEach(p=>{csv+=`${csvSafe(p.nome)};${csvSafe(p.cpf)};${csvSafe(p.whatsapp||p.telefone)};${csvSafe(p.email)};${fmt(p.total_real)};${p.freq};${fmtDate(p.ultima_visita_real)};${p.dias_sem_vir===999?"—":p.dias_sem_vir};${p.segmento}\n`;});
    }
    if(tipo==="procedimentos"){
      csv="Procedimento;Realizados;Receita\n";
      porProc.forEach(p=>{csv+=`${csvSafe(p.nome)};${p.realizados};${fmt(p.receita)}\n`;});
    }
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=`esteticapro_${tipo}.csv`;a.click();
  };

  // Envio de campanha
  const enviarCampanha = async () => {
    if(!campForm.mensagem){alert("Preencha a mensagem.");return;}
    setMsgEnviando(true);setMsgStatus("");
    const destinatarios = campForm.segmento ? crmPacientes.filter(p=>p.segmento===campForm.segmento) : crmPacientes;
    await insert("campanhas",{...campForm,total_destinatarios:destinatarios.length,status:"enviando",enviado_em:new Date().toISOString()});
    // Simulação de envio (integração real via Z-API ou SendGrid)
    await new Promise(r=>setTimeout(r,1500));
    setMsgStatus(`✓ Campanha criada para ${destinatarios.length} contatos. Configure Z-API ou SendGrid nas configurações para envio real.`);
    setMsgEnviando(false);
  };

  const abasRel=[
    {id:"financeiro",label:"Financeiro"},
    {id:"profissionais",label:"Profissionais"},
    {id:"procedimentos",label:"Procedimentos"},
    {id:"crm",label:"CRM / Clientes"},
    {id:"marketing",label:"Marketing"},
  ];

  return(
    <div>
      <PH title="Relatórios & CRM" sub="Inteligência de negócio"/>

      <FilterBar
        filters={[
          {key:"de",type:"date",label:"De"},
          {key:"ate",type:"date",label:"Até"},
          {key:"profissional",type:"select",label:"Profissional",options:data.profissionais.map(p=>({value:String(p.id),label:p.nome}))},
          {key:"procedimento",type:"select",label:"Procedimento",options:data.procedimentos.map(p=>({value:String(p.id),label:p.nome}))},
        ]}
        values={filt} onChange={ff}
      />

      <div style={{display:"flex",gap:7,marginBottom:16,flexWrap:"wrap"}}>
        {abasRel.map(a=>(
          <button key={a.id} onClick={()=>setAba(a.id)} style={{padding:"7px 16px",borderRadius:8,border:`1px solid ${aba===a.id?C.accent:C.border}`,background:aba===a.id?C.accentSoft:"transparent",color:aba===a.id?C.accent:C.muted,fontSize:12,fontWeight:aba===a.id?700:400}}>{a.label}</button>
        ))}
      </div>

      {/* FINANCEIRO */}
      {aba==="financeiro"&&<div>
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}><Btn v="g" onClick={()=>exportExcel("financeiro")}><I.Excel s={12}/> Exportar CSV</Btn></div>
        <div className="stat-row" style={{display:"flex",gap:9,marginBottom:14,flexWrap:"wrap"}}>
          <SC label="Receita" value={fmt(rec)} Icon={I.Up} color={C.success}/>
          <SC label="Despesas" value={fmt(tf+tv)} Icon={I.Dollar} color={C.danger}/>
          <SC label="Lucro" value={fmt(lucro)} Icon={I.Sparkle} color={C.accent} sub={`Margem ${rec>0?Math.round(lucro/rec*100):0}%`}/>
          <SC label="Ticket Médio" value={fmt(ticket)} Icon={I.Tag} color={C.info}/>
          <SC label="Atendimentos" value={atsFilt.length} Icon={I.Receipt} color={C.purple}/>
          <SC label="Tx. Conversão" value={`${txConversao}%`} Icon={I.ArrowUpDown} color={C.warn} sub="Agend.→Atend."/>
        </div>
        <div className="g1" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:13,padding:14}}>
            <h3 style={{color:C.text,fontSize:12,fontWeight:700,marginBottom:12}}>Receita por Forma de Pagamento</h3>
            {fpList.map(([fp,val])=>(
              <div key={fp} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{color:C.text,fontSize:12}}>{fp}</span>
                  <span style={{color:C.accent,fontWeight:700,fontSize:12}}>{fmt(val)}</span>
                </div>
                <div style={{background:C.surface,borderRadius:20,height:5}}>
                  <div style={{width:`${rec>0?val/rec*100:0}%`,height:"100%",background:C.accent,borderRadius:20}}/>
                </div>
              </div>
            ))}
          </div>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:13,padding:14}}>
            <h3 style={{color:C.text,fontSize:12,fontWeight:700,marginBottom:12}}>Composição de Custos</h3>
            {(()=>{
              const custoTotal = atsFilt.reduce((s,at)=>{
                const itens = (data.atendimento_itens||[]).filter(i=>i.atendimento_id===at.id);
                if(itens.length>0){
                  // Tem itens detalhados — usa custo real de cada um
                  return s + itens.reduce((si,item)=>{
                    if(item.tipo==="produto"){
                      const prod = data.produtos.find(p=>p.id===item.produto_id);
                      return si + (Number(prod?.custo_unitario)||0)*(Number(item.quantidade)||1);
                    }
                    if(item.tipo==="procedimento"){
                      const proc = data.procedimentos.find(p=>p.id===item.procedimento_id);
                      // custo_total do procedimento já inclui insumos + custo fixo
                      return si + (Number(proc?.custo_total)||0)*(Number(item.quantidade)||1);
                    }
                    return si;
                  },0);
                } else {
                  // Atendimento sem itens — usa custo_total do procedimento vinculado
                  const proc = data.procedimentos.find(p=>p.id===at.procedimento_id||p.nome===at.servico);
                  return s + (Number(proc?.custo_total)||0);
                }
              },0);
              const lucroReal = rec - custoTotal;
              return [
                ["Custo Total (Insumos + Custo Fixo)", custoTotal, C.danger],
                ["Lucro Líquido", Math.max(0, lucroReal), C.success],
              ].map(([label,val,cor])=>(
                <div key={label} style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{color:C.text,fontSize:12}}>{label}</span>
                    <span style={{color:cor,fontWeight:700,fontSize:12}}>{fmt(val)} ({rec>0?Math.round(val/rec*100):0}%)</span>
                  </div>
                  <div style={{background:C.surface,borderRadius:20,height:5}}>
                    <div style={{width:`${rec>0?Math.min(val/rec*100,100):0}%`,height:"100%",background:cor,borderRadius:20}}/>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>}

      {/* PROFISSIONAIS */}
      {aba==="profissionais"&&<div>
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}><Btn v="g" onClick={()=>exportExcel("profissionais")}><I.Excel s={12}/> Exportar CSV</Btn></div>
        {porProf.map(p=>(
          <div key={p.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:13,padding:14,marginBottom:11}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:(p.cor||"#888")+"22",display:"flex",alignItems:"center",justifyContent:"center",color:p.cor||"#888",fontWeight:700,fontSize:14}}>{p.nome[0]}</div>
              <div><div style={{color:C.text,fontWeight:700,fontSize:14}}>{p.nome}</div><div style={{color:C.muted,fontSize:11}}>{p.especialidade} · {p.atend} atendimentos</div></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:9}}>
              {[["Receita",fmt(p.receita),C.success],["Comissão/Custo",fmt(p.custo),C.danger],["Resultado",fmt(p.resultado),p.resultado>=0?C.success:C.danger],["Ticket Médio",fmt(p.ticket),C.accent]].map(([l,v,c])=>(
                <div key={l} style={{background:C.surface,borderRadius:8,padding:"8px 10px"}}>
                  <div style={{color:C.muted,fontSize:9,textTransform:"uppercase",marginBottom:2}}>{l}</div>
                  <div style={{color:c,fontWeight:700,fontSize:13}}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>}

      {/* PROCEDIMENTOS */}
      {aba==="procedimentos"&&<div>
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}><Btn v="g" onClick={()=>exportExcel("procedimentos")}><I.Excel s={12}/> Exportar CSV</Btn></div>
        <ST cols={["Rank","Procedimento","Categoria","Realizados","Receita","% da Receita"]}
          rows={porProc.map((p,i)=>[
            <div style={{width:24,height:24,borderRadius:"50%",background:i===0?C.accent+"28":C.surface,display:"flex",alignItems:"center",justifyContent:"center",color:i===0?C.accent:C.muted,fontWeight:700,fontSize:11}}>{i+1}</div>,
            <span style={{fontWeight:600,color:C.text}}>{p.nome}</span>,
            <span style={{color:C.muted,fontSize:11}}>{p.categoria||"—"}</span>,
            <span style={{color:C.info,fontWeight:600}}>{p.realizados}</span>,
            <span style={{color:C.accent,fontWeight:700}}>{fmt(p.receita)}</span>,
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{flex:1,background:C.surface,borderRadius:20,height:5}}><div style={{width:`${rec>0?p.receita/rec*100:0}%`,height:"100%",background:C.accent,borderRadius:20}}/></div>
              <span style={{color:C.muted,fontSize:10,minWidth:32}}>{rec>0?Math.round(p.receita/rec*100):0}%</span>
            </div>
          ])}
        />
      </div>}

      {/* CRM */}
      {aba==="crm"&&<div>
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12,gap:8}}>
          <Btn v="g" onClick={()=>exportExcel("crm")}><I.Excel s={12}/> Exportar CSV</Btn>
        </div>
        <div className="stat-row" style={{display:"flex",gap:9,marginBottom:14,flexWrap:"wrap"}}>
          <SC label="VIPs" value={segs.vip.length} Icon={I.Star} color={C.accent} sub="+R$3.000 gasto"/>
          <SC label="Regulares" value={segs.regular.length} Icon={I.Users} color={C.success} sub="R$1k-3k gasto"/>
          <SC label="Novos" value={segs.novo.length} Icon={I.User} color={C.info} sub="Potencial alto"/>
          <SC label="Reengajamento" value={segs.reengajamento.length} Icon={I.Warn} color={C.warn} sub="+60 dias sem vir"/>
        </div>
        <ST cols={["Paciente","WhatsApp","Segmento","Total Gasto","Visitas","Última Visita","Dias Ausente","Ação"]}
          rows={crmPacientes.map(p=>{
            const segCor={vip:C.accent,regular:C.success,novo:C.info,inativo:C.muted};
            return[
              <div><div style={{fontWeight:600,fontSize:12,color:C.text}}>{p.nome}</div><div style={{color:C.muted,fontSize:10}}>{p.email||"—"}</div></div>,
              <a href={`https://wa.me/55${(p.whatsapp||p.telefone||"").replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{color:C.success,fontSize:11,display:"flex",alignItems:"center",gap:3,textDecoration:"none"}}><I.Whatsapp c={C.success} s={11}/>{p.whatsapp||p.telefone||"—"}</a>,
              <Badge text={p.segmento} color={segCor[p.segmento]||C.muted}/>,
              <span style={{color:C.accent,fontWeight:700}}>{fmt(p.total_real)}</span>,
              <span style={{color:C.info,fontWeight:600}}>{p.freq}</span>,
              <span style={{fontSize:11}}>{fmtDate(p.ultima_visita_real)}</span>,
              <span style={{color:p.dias_sem_vir>=60?C.danger:C.muted,fontWeight:p.dias_sem_vir>=60?700:400,fontSize:11}}>{p.dias_sem_vir===999?"Nunca":p.dias_sem_vir+"d"}</span>,
              <a href={`https://wa.me/55${(p.whatsapp||p.telefone||"").replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{display:"inline-flex",alignItems:"center",gap:4,background:C.success+"20",color:C.success,padding:"3px 9px",borderRadius:7,fontSize:10,fontWeight:600,textDecoration:"none"}}><I.Whatsapp c={C.success} s={11}/> WhatsApp</a>
            ];
          })}
        />
      </div>}

      {/* MARKETING */}
      {aba==="marketing"&&<div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div>
            <h3 style={{color:C.text,fontSize:14,fontWeight:700}}>E-mail & WhatsApp Marketing</h3>
            <p style={{color:C.muted,fontSize:12,marginTop:2}}>Crie campanhas segmentadas para seus pacientes</p>
          </div>
          <Btn onClick={()=>setCampModal(true)}><I.Megaphone s={12}/> Nova Campanha</Btn>
        </div>

        {/* Segmentos prontos */}
        <div className="g2" style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:11,marginBottom:16}}>
          {[
            {seg:"vip",label:"Clientes VIP",desc:"Clientes com mais de R$3.000 gastos. Ofereça exclusividades.",cor:C.accent,icon:I.Star,qtd:segs.vip.length},
            {seg:"reengajamento",label:"Reengajamento",desc:"Clientes que não visitam há mais de 60 dias. Reconquiste!",cor:C.warn,icon:I.Refresh,qtd:segs.reengajamento.length},
            {seg:"novo",label:"Novos Pacientes",desc:"Pacientes com poucas visitas. Fidelize com promoções.",cor:C.info,icon:I.User,qtd:segs.novo.length},
            {seg:"",label:"Todos os Pacientes",desc:"Envie comunicados gerais ou newsletters para toda a base.",cor:C.success,icon:I.Users,qtd:data.pacientes.length},
          ].map(item=>(
            <div key={item.seg} style={{background:C.card,border:`1px solid ${item.cor}30`,borderRadius:12,padding:14}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <div style={{background:item.cor+"18",borderRadius:8,width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center"}}><item.icon c={item.cor} s={14}/></div>
                <div><div style={{color:C.text,fontWeight:600,fontSize:12}}>{item.label}</div><div style={{color:item.cor,fontSize:10,fontWeight:700}}>{item.qtd} contatos</div></div>
              </div>
              <p style={{color:C.muted,fontSize:11,lineHeight:1.5,marginBottom:10}}>{item.desc}</p>
              <Btn v="g" onClick={()=>{setCampForm(f=>({...f,segmento:item.seg,nome:`Campanha ${item.label}`}));setCampModal(true);}} style={{width:"100%",justifyContent:"center",fontSize:11}}><I.Send s={11}/> Criar Campanha</Btn>
            </div>
          ))}
        </div>

        {/* Histórico de campanhas */}
        {data.campanhas.length>0&&<>
          <h4 style={{color:C.text,fontSize:12,fontWeight:700,marginBottom:10}}>Histórico de Campanhas</h4>
          <ST cols={["Campanha","Tipo","Segmento","Destinatários","Status","Enviada em"]}
            rows={data.campanhas.map(c=>[
              <span style={{fontWeight:600}}>{c.nome}</span>,
              <Badge text={c.tipo} color={c.tipo==="whatsapp"?C.success:C.info}/>,
              <span style={{color:C.muted,fontSize:11}}>{c.segmento||"Todos"}</span>,
              <span style={{color:C.text,fontWeight:600}}>{c.total_destinatarios}</span>,
              <Badge text={c.status} color={c.status==="enviada"?C.success:c.status==="enviando"?C.warn:C.muted}/>,
              <span style={{fontSize:11}}>{c.enviado_em?new Date(c.enviado_em).toLocaleDateString("pt-BR"):"—"}</span>
            ])}
          />
        </>}

        <div style={{marginTop:14,background:C.warn+"10",border:`1px solid ${C.warn}25`,borderRadius:10,padding:"10px 14px"}}>
          <div style={{color:C.warn,fontSize:11,fontWeight:700,marginBottom:4}}>⚙ Configuração de APIs</div>
          <div style={{color:C.muted,fontSize:11,lineHeight:1.6}}>
            Para envio real de mensagens, configure nas integrações:<br/>
            • <strong style={{color:C.text}}>WhatsApp:</strong> Z-API (z-api.io) — instância e token nos campos de configuração da clínica<br/>
            • <strong style={{color:C.text}}>E-mail:</strong> SendGrid (sendgrid.com) — API key no painel de configurações (gratuito até 100/dia)
          </div>
        </div>
      </div>}

      {/* MODAL CAMPANHA */}
      {campModal&&<Mod title="Nova Campanha" onClose={()=>{setCampModal(false);setMsgStatus("");}} wide>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Inp label="Nome da campanha" value={campForm.nome} onChange={e=>setCampForm(f=>({...f,nome:e.target.value}))} style={{gridColumn:"1/-1"}}/>
          <Sel label="Tipo de envio" value={campForm.tipo} onChange={e=>setCampForm(f=>({...f,tipo:e.target.value}))} options={[{value:"whatsapp",label:"WhatsApp"},{value:"email",label:"E-mail"}]}/>
          <Sel label="Segmento" value={campForm.segmento} onChange={e=>setCampForm(f=>({...f,segmento:e.target.value}))} options={[{value:"",label:"Todos os pacientes"},{value:"vip",label:"VIPs"},{value:"regular",label:"Regulares"},{value:"novo",label:"Novos"},{value:"reengajamento",label:"Reengajamento (+60 dias)"}]}/>
        </div>
        {campForm.tipo==="email"&&<Inp label="Assunto do e-mail" value={campForm.assunto} onChange={e=>setCampForm(f=>({...f,assunto:e.target.value}))} placeholder="Ex: Novidades do Studio Lumière ✨"/>}
        <TA label="Mensagem (use {nome} para personalizar)" value={campForm.mensagem} onChange={e=>setCampForm(f=>({...f,mensagem:e.target.value}))} placeholder={campForm.tipo==="whatsapp"?"Olá {nome}! Aqui é da Clínica Lumière. Temos uma novidade especial para você...":"Prezada {nome},\n\nGostaríamos de compartilhar..."} style={{minHeight:120}}/>
        <div style={{background:C.surface,borderRadius:9,padding:"9px 12px",marginBottom:10,display:"flex",gap:8,alignItems:"center"}}>
          <I.Users c={C.info} s={14}/>
          <span style={{color:C.text,fontSize:12}}>
            <strong>{campForm.segmento?crmPacientes.filter(p=>p.segmento===campForm.segmento).length:data.pacientes.length}</strong> destinatários selecionados
          </span>
        </div>
        {msgStatus&&<div style={{background:C.success+"14",border:`1px solid ${C.success}30`,borderRadius:8,padding:"9px 12px",marginBottom:10,color:C.success,fontSize:12}}>{msgStatus}</div>}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Btn v="g" onClick={()=>{setCampModal(false);setMsgStatus("");}}>Cancelar</Btn>
          <Btn onClick={enviarCampanha} disabled={!campForm.nome||!campForm.mensagem||msgEnviando}>
            {msgEnviando?<><Spin c="#FFFFFF" s={12}/>Enviando...</>:<><I.Send s={12}/> Enviar Campanha</>}
          </Btn>
        </div>
      </Mod>}
    </div>
  );
}


/* ─── CADASTROS AUXILIARES ───────────────────────────────────── */
/* ─── EDITOR DE HORÁRIO DE TRABALHO (dentro do cadastro do profissional) ── */
const DIAS_SEMANA = [
  {v:1,l:"Segunda"},{v:2,l:"Terça"},{v:3,l:"Quarta"},{v:4,l:"Quinta"},
  {v:5,l:"Sexta"},{v:6,l:"Sábado"},{v:0,l:"Domingo"},
];
function HorarioTrabalhoEditor({profissionalId, horarios, insert, update}) {
  const [msg,setMsg] = useState("");
  const [salvando,setSalvando] = useState(false);
  const [dias,setDias] = useState(()=>{
    const base = {};
    DIAS_SEMANA.forEach(d=>{
      const existente = horarios.find(h=>h.profissional_id===profissionalId && h.dia_semana===d.v);
      base[d.v] = existente
        ? {ativo:existente.ativo, hora_inicio:existente.hora_inicio, hora_fim:existente.hora_fim, id:existente.id}
        : {ativo:false, hora_inicio:"09:00", hora_fim:"18:00", id:null};
    });
    return base;
  });

  const atualizarDia = (dia,campo,valor) => setDias(d=>({...d,[dia]:{...d[dia],[campo]:valor}}));

  const salvarHorarios = async () => {
    setSalvando(true); setMsg("");
    for (const d of DIAS_SEMANA) {
      const cfg = dias[d.v];
      const registro = {profissional_id:profissionalId, dia_semana:d.v, hora_inicio:cfg.hora_inicio, hora_fim:cfg.hora_fim, ativo:cfg.ativo};
      if (cfg.id) await update("horarios_profissional", cfg.id, registro);
      else await insert("horarios_profissional", registro);
    }
    setSalvando(false);
    setMsg("✓ Horários salvos!");
  };

  return (
    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:13,marginBottom:14}}>
      <div style={{color:C.text,fontSize:12,fontWeight:700,marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
        <I.Cal c={C.accent} s={13}/> Horário de Trabalho
      </div>
      {DIAS_SEMANA.map(d=>(
        <div key={d.v} style={{display:"grid",gridTemplateColumns:"90px auto 1fr 1fr",gap:8,alignItems:"center",marginBottom:7}}>
          <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
            <input type="checkbox" checked={dias[d.v].ativo} onChange={e=>atualizarDia(d.v,"ativo",e.target.checked)} style={{width:14,height:14,accentColor:C.accent}}/>
            <span style={{color:C.text,fontSize:12}}>{d.l}</span>
          </label>
          {dias[d.v].ativo ? <>
            <span style={{color:C.muted,fontSize:10}}>das</span>
            <input type="time" value={dias[d.v].hora_inicio} onChange={e=>atualizarDia(d.v,"hora_inicio",e.target.value)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:"5px 8px",color:C.text,fontSize:12}}/>
            <input type="time" value={dias[d.v].hora_fim} onChange={e=>atualizarDia(d.v,"hora_fim",e.target.value)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:"5px 8px",color:C.text,fontSize:12}}/>
          </> : <span style={{color:C.muted,fontSize:11,gridColumn:"2/5"}}>Não atende</span>}
        </div>
      ))}
      {msg&&<div style={{color:C.success,fontSize:11,marginTop:6}}>{msg}</div>}
      <Btn v="i" onClick={salvarHorarios} disabled={salvando} style={{marginTop:8,fontSize:11}}>
        {salvando?<><Spin s={11} c={C.info}/>Salvando...</>:<><I.Check s={11}/> Salvar Horários</>}
      </Btn>
    </div>
  );
}

function Cadastros({data,insert,update,remove,user}) {
  const [aba,setAba] = useState("fp");
  const [catAba,setCatAba] = useState("categorias");
  const [modal,setModal] = useState(false);
  const [editing,setEditing] = useState(null);
  const [form,setForm] = useState({});
  const fv = (k,v) => setForm(p=>({...p,[k]:v}));

  // Usuários
  const [usuarios,setUsuarios] = useState([]);
  const [novoUser,setNovoUser] = useState({email:"",password:"",nome:"",role:"profissional",profissional_id:""});
  const [msgUser,setMsgUser] = useState("");
  const [loadingUser,setLoadingUser] = useState(false);
  const isSupervisor = !user || user.role !== "profissional";

  // ── Lembretes WhatsApp ──
  const [clinicaConfig,setClinicaConfig] = useState({
    whatsapp_ativo:false, zapi_instance:"", zapi_token:"",
    lembrete_1dia_ativo:true, lembrete_1dia_texto:"Olá {nome}! Passando para lembrar do seu horário amanhã, {data} às {hora} para {procedimento}. Contamos com você! 💕",
    lembrete_1hora_ativo:true, lembrete_1hora_texto:"Olá {nome}! Seu horário é daqui a 1 hora ({hora}) para {procedimento}. Já estamos te esperando! ✨",
  });
  const [msgLembrete,setMsgLembrete] = useState("");
  const [enviandoLembretes,setEnviandoLembretes] = useState(false);

  const carregarConfigClinica = async () => {
    if(DEMO_MODE) return;
    try {
      const r = await sb.get("clinicas", `id=eq.${user.id}`);
      if(r?.[0]) setClinicaConfig(c=>({...c,...r[0]}));
    } catch(e){ console.error(e); }
  };

  useEffect(()=>{ if(aba==="lembretes") carregarConfigClinica(); },[aba]); // eslint-disable-line

  const salvarConfigLembretes = async () => {
    setMsgLembrete("");
    if(DEMO_MODE){ setMsgLembrete("✓ Configuração salva (modo demo)."); return; }
    try {
      await sb.patch("clinicas", user.id, clinicaConfig);
      setMsgLembrete("✓ Configuração salva com sucesso!");
    } catch(e){ setMsgLembrete("Erro ao salvar."); }
  };

  const montarMensagem = (template, ag) => template
    .replace(/{nome}/g, ag.paciente||"")
    .replace(/{data}/g, fmtDate(ag.data))
    .replace(/{hora}/g, ag.hora||"")
    .replace(/{procedimento}/g, ag.servico||"");

  /* Verifica agendamentos de amanhã e da próxima hora, e envia via Z-API se configurado.
     Em produção, esta checagem deve rodar automaticamente via Supabase Edge Function + Cron
     (não é possível agendar tarefas recorrentes só no navegador). Este botão dispara manualmente. */
  const verificarEEnviarLembretes = async () => {
    setEnviandoLembretes(true);
    let enviados1dia=0, enviados1hora=0, erros=0;
    const amanha = new Date(); amanha.setDate(amanha.getDate()+1);
    const amanhaStr = amanha.toISOString().split("T")[0];
    const agora = new Date();

    const pendentes1dia = data.agendamentos.filter(a=>a.data===amanhaStr && a.status!=="cancelado" && !a.lembrete_1dia_enviado);
    const pendentes1hora = data.agendamentos.filter(a=>{
      if(a.data!==today() || a.status==="cancelado" || a.lembrete_1hora_enviado) return false;
      const [h,m] = (a.hora||"00:00").split(":").map(Number);
      const horarioAg = new Date(); horarioAg.setHours(h,m,0,0);
      const diffMin = (horarioAg-agora)/60000;
      return diffMin>0 && diffMin<=60;
    });

    const enviarZAPI = async (telefone, mensagem) => {
      if(!clinicaConfig.whatsapp_ativo || !clinicaConfig.zapi_instance || !clinicaConfig.zapi_token) return false;
      try {
        const numero = (telefone||"").replace(/\D/g,"");
        if(!numero) return false;
        await fetch(`https://api.z-api.io/instances/${clinicaConfig.zapi_instance}/token/${clinicaConfig.zapi_token}/send-text`,{
          method:"POST", headers:{"Content-Type":"application/json"},
          body:JSON.stringify({phone:`55${numero}`, message:mensagem}),
        });
        return true;
      } catch(e){ return false; }
    };

    if(clinicaConfig.lembrete_1dia_ativo){
      for(const ag of pendentes1dia){
        const pac = data.pacientes.find(p=>p.id===ag.paciente_id);
        const msg = montarMensagem(clinicaConfig.lembrete_1dia_texto, ag);
        const ok = await enviarZAPI(pac?.whatsapp||pac?.telefone, msg);
        if(ok){ enviados1dia++; await update("agendamentos", ag.id, {lembrete_1dia_enviado:true}); }
        else erros++;
      }
    }
    if(clinicaConfig.lembrete_1hora_ativo){
      for(const ag of pendentes1hora){
        const pac = data.pacientes.find(p=>p.id===ag.paciente_id);
        const msg = montarMensagem(clinicaConfig.lembrete_1hora_texto, ag);
        const ok = await enviarZAPI(pac?.whatsapp||pac?.telefone, msg);
        if(ok){ enviados1hora++; await update("agendamentos", ag.id, {lembrete_1hora_enviado:true}); }
        else erros++;
      }
    }

    setEnviandoLembretes(false);
    if(!clinicaConfig.whatsapp_ativo){
      setMsgLembrete(`⚠ WhatsApp não está ativo/configurado. Encontrados: ${pendentes1dia.length} lembrete(s) de 1 dia e ${pendentes1hora.length} de 1 hora pendentes — configure a Z-API acima para enviar.`);
    } else {
      setMsgLembrete(`✓ Enviados: ${enviados1dia} lembrete(s) de 1 dia, ${enviados1hora} de 1 hora. ${erros>0?`${erros} erro(s).`:""}`);
    }
  };

  const carregarUsuarios = async () => {
    if(DEMO_MODE){
      setUsuarios([
        {id:"demo-1",email:"demo@clinica.com",nome:"Michelangelo (Supervisor)",role:"supervisor",created_at:new Date().toISOString()},
        {id:"demo-3",email:"profissional@clinica.com",nome:"Dra. Camila Rocha",role:"profissional",created_at:new Date().toISOString()},
      ]);
      return;
    }
    try {
      const r = await sb.get("usuarios_clinica", `clinica_id=eq.${user?.id}&ativo=eq.true`);
      setUsuarios(r||[]);
    } catch(e){ console.error(e); }
  };

  useEffect(()=>{ if(aba==="usuarios") carregarUsuarios(); },[aba]); // eslint-disable-line

  const criarUsuario = async () => {
    if(!novoUser.email||!novoUser.password||!novoUser.nome){ setMsgUser("Preencha nome, e-mail e senha."); return; }
    if(novoUser.role==="profissional" && !novoUser.profissional_id){ setMsgUser("Selecione qual profissional este login representa."); return; }
    setLoadingUser(true); setMsgUser("");
    if(DEMO_MODE){
      await new Promise(r=>setTimeout(r,600));
      setMsgUser("✓ Usuário criado (modo demo).");
      setNovoUser({email:"",password:"",nome:"",role:"profissional",profissional_id:""});
      setLoadingUser(false);
      return;
    }
    try {
      /* 1. Cria a conta de autenticação via signup público (não precisa de service_role) */
      const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`,{
        method:"POST",
        headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY},
        body:JSON.stringify({email:novoUser.email,password:novoUser.password})
      });
      const d = await r.json();
      if(d.error||!d.id){ setMsgUser(`Erro: ${d.error_description||d.msg||"não foi possível criar o usuário"}`); setLoadingUser(false); return; }

      /* 2. Vincula o novo usuário à clínica com o papel escolhido */
      await sb.post("usuarios_clinica",{
        auth_user_id:d.id, clinica_id:user.id,
        nome:novoUser.nome, email:novoUser.email, role:novoUser.role,
        profissional_id:novoUser.role==="profissional"?parseInt(novoUser.profissional_id):null,
        ativo:true,
      });

      setMsgUser("✓ Usuário criado! Ele já pode fazer login com o e-mail e senha cadastrados.");
      setNovoUser({email:"",password:"",nome:"",role:"profissional",profissional_id:""});
      carregarUsuarios();
    } catch(e){ setMsgUser("Erro de conexão."); }
    setLoadingUser(false);
  };

  const excluirUsuario = async (id) => {
    if(!window.confirm("Remover o acesso deste usuário?")) return;
    if(DEMO_MODE){ setUsuarios(u=>u.filter(u=>u.id!==id)); return; }
    try {
      await sb.patch("usuarios_clinica", id, {ativo:false});
      carregarUsuarios();
    } catch(e){ console.error(e); }
  };

  const salvar = async () => {
    const tableMap = {fp:"formas_pagamento",cb:"contas_bancarias",prof:"profissionais",cat:catAba==="contasdre"?"contas_dre":"categorias_financeiras"};
    const table = tableMap[aba];
    if(!table) return;
    let rec = form;
    if(table==="categorias_financeiras") rec = {...form, conta_dre_id: form.conta_dre_id?Number(form.conta_dre_id):null};
    if(table==="contas_dre") rec = {...form, ordem: Number(form.ordem)||0, tipo: grupoDRE(form.grupo)?.tipo||"despesa"};
    if(editing){ await update(table,editing.id,rec); }
    else { await insert(table,rec); }
    setModal(false); setEditing(null); setForm({});
  };

  const abrirModal = (item, initForm) => {
    setEditing(item||null);
    setForm(item ? {...item} : initForm);
    setModal(true);
  };

  return (
    <div>
      <PH title="Cadastros" sub="Configurações e dados auxiliares"/>

      <div style={{display:"flex",gap:7,marginBottom:16,flexWrap:"wrap"}}>
        {[["fp","Formas de Pagamento"],["cb","Contas e Caixa"],["cat","Categorias"],["prof","Profissionais"],["usuarios","Usuários"],["lembretes","Lembretes WhatsApp"]].map(a=>(
          <button key={a[0]} onClick={()=>{setAba(a[0]);setModal(false);setMsgUser("");}}
            style={{padding:"7px 14px",borderRadius:8,border:`1px solid ${aba===a[0]?C.accent:C.border}`,background:aba===a[0]?C.accentSoft:"transparent",color:aba===a[0]?C.accent:C.muted,fontSize:12,fontWeight:aba===a[0]?700:400,cursor:"pointer"}}>
            {a[1]}
          </button>
        ))}
      </div>

      {/* FORMAS DE PAGAMENTO */}
      {aba==="fp"&&<>
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:11}}>
          <Btn onClick={()=>abrirModal(null,{nome:"",tipo:"pix",prazo_dias:0,taxa_percentual:0,ativo:true})}><I.Plus s={12}/> Adicionar</Btn>
        </div>
        <ST cols={["Nome","Tipo","Prazo","Taxa %","Status","Ações"]}
          rows={data.formas_pagamento.map(fp=>[
            <span style={{fontWeight:600}}>{fp.nome}</span>,
            <Badge text={fp.tipo} color={C.info}/>,
            <span style={{color:C.muted}}>{fp.prazo_dias}d</span>,
            <span style={{color:C.warn}}>{fmtN(fp.taxa_percentual)}%</span>,
            <Badge text={fp.ativo?"Ativo":"Inativo"} color={fp.ativo?C.success:C.muted}/>,
            <div style={{display:"flex",gap:4}}>
              <Btn v="g" onClick={()=>abrirModal(fp,{})} style={{padding:"3px 7px"}}><I.Edit s={11}/></Btn>
              <Btn v="d" onClick={()=>remove("formas_pagamento",fp.id)} style={{padding:"3px 7px"}}><I.X s={11}/></Btn>
            </div>
          ])}
        />
        {modal&&<Mod title={editing?"Editar Forma de Pagamento":"Nova Forma de Pagamento"} onClose={()=>{setModal(false);setEditing(null);}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Inp label="Nome" value={form.nome||""} onChange={e=>fv("nome",e.target.value)} style={{gridColumn:"1/-1"}}/>
            <Sel label="Tipo" value={form.tipo||"pix"} onChange={e=>fv("tipo",e.target.value)} options={["dinheiro","pix","debito","credito","transferencia","outro"].map(t=>({value:t,label:t}))}/>
            <Inp label="Prazo (dias)" type="number" value={form.prazo_dias||0} onChange={e=>fv("prazo_dias",e.target.value)}/>
            <Inp label="Taxa (%)" type="number" value={form.taxa_percentual||0} onChange={e=>fv("taxa_percentual",e.target.value)}/>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:10}}>
            <Btn v="g" onClick={()=>{setModal(false);setEditing(null);}}>Cancelar</Btn>
            <Btn onClick={salvar}><I.Check s={12}/> Salvar</Btn>
          </div>
        </Mod>}
      </>}

      {/* CONTAS BANCÁRIAS */}
      {aba==="cb"&&<>
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:11}}>
          <Btn onClick={()=>abrirModal(null,{nome:"",tipo:"caixa",banco:"",agencia:"",conta:"",saldo_inicial:0,ativo:true})}><I.Plus s={12}/> Adicionar</Btn>
        </div>
        <ST cols={["Conta","Tipo","Banco","Saldo Inicial","Status","Ações"]}
          rows={data.contas_bancarias.map(cb=>[
            <span style={{fontWeight:600}}>{cb.nome}</span>,
            <Badge text={cb.tipo} color={cb.tipo==="caixa"?C.warn:C.info}/>,
            <span style={{color:C.muted,fontSize:11}}>{cb.banco||"—"}</span>,
            <span style={{color:C.success,fontWeight:600}}>{fmt(cb.saldo_inicial)}</span>,
            <Badge text={cb.ativo?"Ativo":"Inativo"} color={cb.ativo?C.success:C.muted}/>,
            <Btn v="g" onClick={()=>abrirModal(cb,{})} style={{padding:"3px 7px"}}><I.Edit s={11}/></Btn>
          ])}
        />
        {modal&&<Mod title={editing?"Editar Conta":"Nova Conta"} onClose={()=>{setModal(false);setEditing(null);}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Inp label="Nome da conta" value={form.nome||""} onChange={e=>fv("nome",e.target.value)} style={{gridColumn:"1/-1"}}/>
            <Sel label="Tipo" value={form.tipo||"caixa"} onChange={e=>fv("tipo",e.target.value)} options={[{value:"caixa",label:"Caixa Físico (atendimentos)"},{value:"caixa_master",label:"Caixa Master (administrativo)"},{value:"conta_corrente",label:"Conta Corrente"},{value:"conta_poupanca",label:"Poupança"},{value:"carteira_digital",label:"Carteira Digital"}]}/>
            <Inp label="Banco" value={form.banco||""} onChange={e=>fv("banco",e.target.value)} placeholder="Nubank, Itaú..."/>
            <Inp label="Agência" value={form.agencia||""} onChange={e=>fv("agencia",e.target.value)}/>
            <Inp label="Conta" value={form.conta||""} onChange={e=>fv("conta",e.target.value)}/>
            <Inp label="Saldo inicial (R$)" type="number" value={form.saldo_inicial||0} onChange={e=>fv("saldo_inicial",e.target.value)}/>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:10}}>
            <Btn v="g" onClick={()=>{setModal(false);setEditing(null);}}>Cancelar</Btn>
            <Btn onClick={salvar}><I.Check s={12}/> Salvar</Btn>
          </div>
        </Mod>}
      </>}

      {/* CATEGORIAS FINANCEIRAS + CONTAS DO DRE */}
      {aba==="cat"&&<>
        <div style={{display:"flex",gap:7,marginBottom:14}}>
          {[["categorias","Categorias"],["contasdre","Contas do DRE"]].map(([id,label])=>(
            <button key={id} onClick={()=>{setCatAba(id);setModal(false);setEditing(null);}} style={{padding:"6px 14px",borderRadius:8,border:`1px solid ${catAba===id?C.accent:C.border}`,background:catAba===id?C.accentSoft:"transparent",color:catAba===id?C.accent:C.muted,fontSize:11,fontWeight:catAba===id?700:400,cursor:"pointer"}}>{label}</button>
          ))}
        </div>

        {catAba==="contasdre"&&<>
          <p style={{color:C.muted,fontSize:11,marginBottom:11}}>As "Contas do DRE" são as linhas do Demonstrativo de Resultado. Os 7 grupos seguem o formato padrão contábil (Receita Bruta, Deduções, Custos, Despesas Operacionais, Resultado Financeiro, Impostos) — dentro de cada grupo você cadastra as contas que fizerem sentido pra sua clínica.</p>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:11}}>
            <Btn onClick={()=>abrirModal(null,{nome:"",grupo:"despesas_operacionais",ordem:0,ativo:true})}><I.Plus s={12}/> Adicionar</Btn>
          </div>
          {GRUPOS_DRE.map(g=>{
            const contas=(data.contas_dre||[]).filter(cd=>cd.grupo===g.id).sort((a,b)=>(a.ordem||0)-(b.ordem||0));
            if(contas.length===0) return null;
            return(
              <div key={g.id} style={{marginBottom:16}}>
                <div style={{color:C.muted,fontSize:10,fontWeight:700,letterSpacing:.6,textTransform:"uppercase",marginBottom:6}}>{g.label}</div>
                <ST cols={["Conta do DRE","Ordem","Status","Ações"]}
                  rows={contas.map(cd=>[
                    <span style={{fontWeight:600}}>{cd.nome}</span>,
                    <span style={{color:C.muted,fontSize:11}}>{cd.ordem||0}</span>,
                    <Badge text={cd.ativo?"Ativa":"Inativa"} color={cd.ativo?C.success:C.muted}/>,
                    <div style={{display:"flex",gap:4}}>
                      <Btn v="g" onClick={()=>abrirModal(cd,{})} style={{padding:"3px 7px"}}><I.Edit s={11}/></Btn>
                      <Btn v="d" onClick={()=>update("contas_dre",cd.id,{ativo:!cd.ativo})} style={{padding:"3px 7px"}}><I.X s={11}/></Btn>
                    </div>
                  ])}
                />
              </div>
            );
          })}
          {(data.contas_dre||[]).length===0 && <p style={{color:C.muted,fontSize:13,textAlign:"center",padding:20}}>Nenhuma conta do DRE cadastrada.</p>}
          {modal&&<Mod title={editing?"Editar Conta do DRE":"Nova Conta do DRE"} onClose={()=>{setModal(false);setEditing(null);}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Inp label="Nome" value={form.nome||""} onChange={e=>fv("nome",e.target.value)} style={{gridColumn:"1/-1"}}/>
              <Sel label="Grupo do DRE" value={form.grupo||"despesas_operacionais"} onChange={e=>fv("grupo",e.target.value)} options={GRUPOS_DRE.map(g=>({value:g.id,label:g.label}))} style={{gridColumn:"1/-1"}}/>
              <Inp label="Ordem de exibição" type="number" value={form.ordem||0} onChange={e=>fv("ordem",e.target.value)}/>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:10}}>
              <Btn v="g" onClick={()=>{setModal(false);setEditing(null);}}>Cancelar</Btn>
              <Btn onClick={salvar}><I.Check s={12}/> Salvar</Btn>
            </div>
          </Mod>}
        </>}

        {catAba==="categorias"&&<>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:11}}>
            <Btn onClick={()=>abrirModal(null,{nome:"",tipo:"despesa",conta_dre_id:"",ativo:true})}><I.Plus s={12}/> Adicionar</Btn>
          </div>
          <ST cols={["Categoria","Tipo","Conta do DRE","Status","Ações"]}
            rows={(data.categorias_financeiras||[]).map(cf=>[
              <span style={{fontWeight:600}}>{cf.nome}</span>,
              <Badge text={cf.tipo==="receita"?"Receita":"Despesa"} color={cf.tipo==="receita"?C.success:C.danger}/>,
              <span style={{color:C.muted,fontSize:11}}>{(data.contas_dre||[]).find(cd=>cd.id===cf.conta_dre_id)?.nome||"— (não entra no DRE)"}</span>,
              <Badge text={cf.ativo?"Ativa":"Inativa"} color={cf.ativo?C.success:C.muted}/>,
              <div style={{display:"flex",gap:4}}>
                <Btn v="g" onClick={()=>abrirModal(cf,{})} style={{padding:"3px 7px"}}><I.Edit s={11}/></Btn>
                <Btn v="d" onClick={()=>update("categorias_financeiras",cf.id,{ativo:!cf.ativo})} style={{padding:"3px 7px"}}><I.X s={11}/></Btn>
              </div>
            ])}
            empty="Nenhuma categoria cadastrada."
          />
          {modal&&<Mod title={editing?"Editar Categoria":"Nova Categoria"} onClose={()=>{setModal(false);setEditing(null);}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Inp label="Nome" value={form.nome||""} onChange={e=>fv("nome",e.target.value)} style={{gridColumn:"1/-1"}}/>
              <Sel label="Tipo" value={form.tipo||"despesa"} onChange={e=>setForm(f=>({...f,tipo:e.target.value,conta_dre_id:""}))} options={[{value:"despesa",label:"Despesa"},{value:"receita",label:"Receita"}]}/>
            </div>
            <Sel label="Conta do DRE (opcional — deixe em branco se não deve entrar no DRE)" value={form.conta_dre_id||""} onChange={e=>fv("conta_dre_id",e.target.value)}
              options={[{value:"",label:"Não entra no DRE"}, ...(data.contas_dre||[]).filter(cd=>cd.tipo===(form.tipo||"despesa")&&cd.ativo!==false).map(cd=>({value:cd.id,label:cd.nome}))]}/>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:10}}>
              <Btn v="g" onClick={()=>{setModal(false);setEditing(null);}}>Cancelar</Btn>
              <Btn onClick={salvar}><I.Check s={12}/> Salvar</Btn>
            </div>
          </Mod>}
        </>}
      </>}

      {/* PROFISSIONAIS */}
      {aba==="prof"&&<>
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:11}}>
          <Btn onClick={()=>abrirModal(null,{nome:"",especialidade:"",tipo:"percentual",percentual:40,salario:0,cor:"#C9A96E",email:"",telefone:"",ativo:true,permite_cadastros:false})}><I.Plus s={12}/> Adicionar</Btn>
        </div>
        <ST cols={["Nome","Especialidade","Remuneração","Cadastros","Cor","Status","Ações"]}
          rows={data.profissionais.map(p=>[
            <span style={{fontWeight:600}}>{p.nome}</span>,
            <span style={{color:C.muted,fontSize:11}}>{p.especialidade||"—"}</span>,
            <span style={{fontSize:11}}>{p.tipo==="percentual"?`${p.percentual}% comissão`:`Fixo ${fmt(p.salario)}`}</span>,
            <Badge text={p.permite_cadastros?"Liberado":"Bloqueado"} color={p.permite_cadastros?C.success:C.muted}/>,
            <div style={{width:18,height:18,borderRadius:"50%",background:p.cor||C.accent}}/>,
            <Badge text={p.ativo?"Ativo":"Inativo"} color={p.ativo?C.success:C.muted}/>,
            <Btn v="g" onClick={()=>abrirModal(p,{})} style={{padding:"3px 7px"}}><I.Edit s={11}/></Btn>
          ])}
        />
        {modal&&<Mod title={editing?"Editar Profissional":"Novo Profissional"} onClose={()=>{setModal(false);setEditing(null);}} wide>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Inp label="Nome completo" value={form.nome||""} onChange={e=>fv("nome",e.target.value)} style={{gridColumn:"1/-1"}}/>
            <Inp label="Especialidade" value={form.especialidade||""} onChange={e=>fv("especialidade",e.target.value)}/>
            <Inp label="E-mail" type="email" value={form.email||""} onChange={e=>fv("email",e.target.value)}/>
            <Inp label="Telefone" value={form.telefone||""} onChange={e=>fv("telefone",maskFone(e.target.value))}/>
            <Sel label="Remuneração" value={form.tipo||"percentual"} onChange={e=>fv("tipo",e.target.value)} options={[{value:"percentual",label:"% Comissão"},{value:"fixo",label:"Salário Fixo"}]}/>
            {(form.tipo||"percentual")==="percentual"
              ? <Inp label="Percentual (%)" type="number" value={form.percentual||40} onChange={e=>fv("percentual",e.target.value)}/>
              : <Inp label="Salário (R$)" type="number" value={form.salario||0} onChange={e=>fv("salario",e.target.value)}/>
            }
            <div>
              <label style={{display:"block",color:C.muted,fontSize:10,letterSpacing:.9,textTransform:"uppercase",marginBottom:4}}>Cor identificadora</label>
              <input type="color" value={form.cor||"#C9A96E"} onChange={e=>fv("cor",e.target.value)} style={{width:"100%",height:40,borderRadius:8,border:`1px solid ${C.border}`,background:C.surface,cursor:"pointer"}}/>
            </div>
          </div>
          <div style={{background:C.accentSoft,borderRadius:9,padding:"11px 13px",marginTop:4,marginBottom:14}}>
            <label style={{display:"flex",alignItems:"flex-start",gap:9,cursor:"pointer"}}>
              <input type="checkbox" checked={!!form.permite_cadastros} onChange={e=>fv("permite_cadastros",e.target.checked)} style={{marginTop:2,accentColor:C.accent,width:16,height:16}}/>
              <div>
                <div style={{color:C.text,fontSize:12,fontWeight:600}}>Permitir cadastro de Produtos, Procedimentos e Fornecedores</div>
                <div style={{color:C.muted,fontSize:11,marginTop:2}}>Quando marcado, este profissional (quando logado com acesso próprio) também vê e cadastra nessas 3 telas — além da agenda e atendimentos próprios.</div>
              </div>
            </label>
          </div>

          {/* Horário de trabalho — só faz sentido para profissional já existente (precisa de id) */}
          {editing && <HorarioTrabalhoEditor profissionalId={editing.id} horarios={data.horarios_profissional||[]} insert={insert} update={update}/>}
          {!editing && <div style={{background:C.warn+"10",border:`1px solid ${C.warn}25`,borderRadius:9,padding:"9px 12px",marginBottom:10}}><span style={{color:C.warn,fontSize:11}}>Salve o profissional primeiro para depois configurar o horário de trabalho.</span></div>}

          <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:10}}>
            <Btn v="g" onClick={()=>{setModal(false);setEditing(null);}}>Cancelar</Btn>
            <Btn onClick={salvar} disabled={!form.nome}><I.Check s={12}/> Salvar</Btn>
          </div>
        </Mod>}
      </>}

      {/* USUÁRIOS */}
      {aba==="usuarios"&&<div>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:13,padding:16,marginBottom:14}}>
          <h3 style={{color:C.text,fontSize:13,fontWeight:700,marginBottom:12,display:"flex",alignItems:"center",gap:7}}>
            <I.Lock c={C.accent} s={14}/> Criar Novo Acesso
          </h3>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Inp label="Nome" value={novoUser.nome} onChange={e=>setNovoUser(u=>({...u,nome:e.target.value}))}/>
            <Sel label="Nível de acesso" value={novoUser.role} onChange={e=>setNovoUser(u=>({...u,role:e.target.value,profissional_id:""}))} options={[{value:"supervisor",label:"Supervisor (acesso total)"},{value:"profissional",label:"Profissional (só a própria agenda)"}]}/>
            <Inp label="E-mail" type="email" value={novoUser.email} onChange={e=>setNovoUser(u=>({...u,email:e.target.value}))} placeholder="usuario@clinica.com"/>
            <Inp label="Senha inicial" type="password" value={novoUser.password} onChange={e=>setNovoUser(u=>({...u,password:e.target.value}))} placeholder="Mín. 6 caracteres"/>
            {novoUser.role==="profissional"&&
              <Sel label="Vincular ao profissional" value={novoUser.profissional_id} onChange={e=>setNovoUser(u=>({...u,profissional_id:e.target.value}))} options={[{value:"",label:"Selecione..."}, ...data.profissionais.map(p=>({value:p.id,label:p.nome}))]} style={{gridColumn:"1/-1"}}/>
            }
          </div>
          {msgUser&&<div style={{background:msgUser.startsWith("✓")?C.success+"14":C.danger+"14",border:`1px solid ${msgUser.startsWith("✓")?C.success:C.danger}30`,borderRadius:8,padding:"8px 12px",marginTop:9,color:msgUser.startsWith("✓")?C.success:C.danger,fontSize:12}}>{msgUser}</div>}
          <div style={{display:"flex",justifyContent:"flex-end",marginTop:12}}>
            <Btn onClick={criarUsuario} disabled={!novoUser.email||!novoUser.password||loadingUser}>
              {loadingUser?<><Spin s={12} c="#FFFFFF"/>Criando...</>:<><I.Plus s={12}/> Criar Usuário</>}
            </Btn>
          </div>
          <div style={{marginTop:11,background:C.info+"10",border:`1px solid ${C.info}25`,borderRadius:8,padding:"9px 12px"}}>
            <span style={{color:C.info,fontSize:11}}>💡 <strong>Supervisor</strong> vê e gerencia tudo. <strong>Profissional</strong> vê apenas sua própria agenda e atendimentos.</span>
          </div>
        </div>
        <h3 style={{color:C.text,fontSize:13,fontWeight:700,marginBottom:10}}>Usuários cadastrados</h3>
        <ST cols={["Nome","E-mail","Nível","Vinculado a","Ação"]}
          rows={usuarios.map(u=>{const prof=data.profissionais.find(p=>p.id===u.profissional_id);return[
            <span style={{fontWeight:600,fontSize:12}}>{u.nome||"—"}</span>,
            <span style={{color:C.muted,fontSize:11}}>{u.email}</span>,
            <Badge text={u.role==="supervisor"?"Supervisor":"Profissional"} color={u.role==="supervisor"?C.accent:C.info}/>,
            <span style={{fontSize:11,color:C.muted}}>{prof?.nome||"—"}</span>,
            <Btn v="d" onClick={()=>excluirUsuario(u.id)} style={{padding:"3px 8px",fontSize:10}}><I.X s={11}/> Remover</Btn>
          ];})}
        />
      </div>}

      {/* LEMBRETES WHATSAPP */}
      {aba==="lembretes"&&<div>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:13,padding:16,marginBottom:14}}>
          <h3 style={{color:C.text,fontSize:13,fontWeight:700,marginBottom:4,display:"flex",alignItems:"center",gap:7}}><I.Whatsapp c={C.success} s={15}/> Integração WhatsApp (Z-API)</h3>
          <p style={{color:C.muted,fontSize:11,marginBottom:12}}>Opcional. Crie uma conta em <strong>z-api.io</strong> para obter instância e token. Sem essa configuração o sistema apenas identifica os lembretes pendentes, sem enviar.</p>
          <label style={{display:"flex",alignItems:"center",gap:9,cursor:"pointer",marginBottom:12}}>
            <input type="checkbox" checked={clinicaConfig.whatsapp_ativo} onChange={e=>setClinicaConfig(c=>({...c,whatsapp_ativo:e.target.checked}))} style={{width:16,height:16,accentColor:C.accent}}/>
            <span style={{color:C.text,fontSize:12,fontWeight:600}}>Ativar envio automático via WhatsApp</span>
          </label>
          {clinicaConfig.whatsapp_ativo&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Inp label="Z-API Instance ID" value={clinicaConfig.zapi_instance} onChange={e=>setClinicaConfig(c=>({...c,zapi_instance:e.target.value}))} placeholder="Ex: 3D9F..."/>
            <Inp label="Z-API Token" value={clinicaConfig.zapi_token} onChange={e=>setClinicaConfig(c=>({...c,zapi_token:e.target.value}))} placeholder="Token de segurança"/>
          </div>}
        </div>

        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:13,padding:16,marginBottom:14}}>
          <label style={{display:"flex",alignItems:"center",gap:9,cursor:"pointer",marginBottom:9}}>
            <input type="checkbox" checked={clinicaConfig.lembrete_1dia_ativo} onChange={e=>setClinicaConfig(c=>({...c,lembrete_1dia_ativo:e.target.checked}))} style={{width:16,height:16,accentColor:C.accent}}/>
            <span style={{color:C.text,fontSize:13,fontWeight:700}}>Lembrete — 1 dia antes</span>
          </label>
          <TA label="Mensagem (use {nome}, {data}, {hora}, {procedimento})" value={clinicaConfig.lembrete_1dia_texto} onChange={e=>setClinicaConfig(c=>({...c,lembrete_1dia_texto:e.target.value}))} style={{minHeight:70}}/>
        </div>

        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:13,padding:16,marginBottom:14}}>
          <label style={{display:"flex",alignItems:"center",gap:9,cursor:"pointer",marginBottom:9}}>
            <input type="checkbox" checked={clinicaConfig.lembrete_1hora_ativo} onChange={e=>setClinicaConfig(c=>({...c,lembrete_1hora_ativo:e.target.checked}))} style={{width:16,height:16,accentColor:C.accent}}/>
            <span style={{color:C.text,fontSize:13,fontWeight:700}}>Lembrete — 1 hora antes</span>
          </label>
          <TA label="Mensagem (use {nome}, {data}, {hora}, {procedimento})" value={clinicaConfig.lembrete_1hora_texto} onChange={e=>setClinicaConfig(c=>({...c,lembrete_1hora_texto:e.target.value}))} style={{minHeight:70}}/>
        </div>

        {msgLembrete&&<div style={{background:msgLembrete.startsWith("✓")?C.success+"14":C.warn+"14",border:`1px solid ${msgLembrete.startsWith("✓")?C.success:C.warn}30`,borderRadius:8,padding:"9px 12px",marginBottom:12,color:msgLembrete.startsWith("✓")?C.success:C.warn,fontSize:12}}>{msgLembrete}</div>}

        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <Btn onClick={salvarConfigLembretes}><I.Check s={12}/> Salvar Configuração</Btn>
          <Btn v="i" onClick={verificarEEnviarLembretes} disabled={enviandoLembretes}>
            {enviandoLembretes?<><Spin s={12} c={C.info}/>Verificando...</>:<><I.Send s={12}/> Verificar e Enviar Agora</>}
          </Btn>
        </div>

        <div style={{marginTop:14,background:C.info+"10",border:`1px solid ${C.info}25`,borderRadius:10,padding:"11px 14px"}}>
          <div style={{color:C.info,fontSize:11,fontWeight:700,marginBottom:4}}>ℹ Sobre o envio automático</div>
          <div style={{color:C.muted,fontSize:11,lineHeight:1.7}}>
            O botão "Verificar e Enviar Agora" checa manualmente os agendamentos de amanhã e da próxima hora. Para que isso rode <strong>sozinho, sem precisar clicar</strong>, é necessário configurar uma tarefa agendada (Supabase Edge Function + Cron) no backend — fora do escopo deste app React, que roda só no navegador. Posso te ajudar a configurar isso separadamente quando quiser.
          </div>
        </div>
      </div>}
    </div>
  );
}

/* ─── LOCAÇÃO DE SALAS ───────────────────────────────────────── */
function Salas({data, insert, update}) {
  const [modal,setModal] = useState(false);
  const [editing,setEditing] = useState(null);
  const [alugarModal,setAlugarModal] = useState(null);
  const [pagModal,setPagModal] = useState(null);
  const [baixaConta,setBaixaConta] = useState("");
  const init = {nome:"",descricao:"",valor_aluguel:0};
  const [form,setForm] = useState(init);
  const [formLocacao,setFormLocacao] = useState({locatario_nome:"",locatario_cpf:"",locatario_telefone:"",contrato_inicio:today(),contrato_fim:"",observacoes:"",contrato_arquivo_nome:"",contrato_arquivo_base64:""});
  const [uploadNome,setUploadNome] = useState("");

  const salas = data.salas || [];
  const pagamentos = data.aluguel_pagamentos || [];
  const disponiveis = salas.filter(s=>s.status==="disponivel").length;
  const alugadas = salas.filter(s=>s.status==="alugada").length;
  const receitaMensal = salas.filter(s=>s.status==="alugada").reduce((s,sala)=>s+(Number(sala.valor_aluguel)||0),0);
  const pagAbertos = pagamentos.filter(p=>p.status==="aberto");

  const abrirModal = (item) => { if(item){setEditing(item);setForm(item);} else {setEditing(null);setForm(init);} setModal(true); };
  const salvar = async () => {
    const rec = {...form, valor_aluguel:Number(form.valor_aluguel)};
    if(editing) await update("salas", editing.id, rec);
    else await insert("salas", {...rec, status:"disponivel"});
    setModal(false);
  };

  const abrirAlugar = (sala) => {
    setFormLocacao({locatario_nome:"",locatario_cpf:"",locatario_telefone:"",contrato_inicio:today(),contrato_fim:"",observacoes:"",contrato_arquivo_nome:"",contrato_arquivo_base64:""});
    setUploadNome("");
    setAlugarModal(sala);
  };

  const handleUploadContrato = (e) => {
    const file = e.target.files?.[0];
    if(!file) return;
    if(file.size > 4*1024*1024){ alert("Arquivo muito grande. Máximo 4MB."); return; }
    setUploadNome(file.name);
    const reader = new FileReader();
    reader.onload = () => setFormLocacao(f=>({...f, contrato_arquivo_base64:reader.result, contrato_arquivo_nome:file.name}));
    reader.readAsDataURL(file);
  };

  const confirmarLocacao = async () => {
    if(!formLocacao.locatario_nome) return;
    await update("salas", alugarModal.id, {
      status:"alugada",
      locatario_nome:formLocacao.locatario_nome,
      locatario_cpf:maskCPF(formLocacao.locatario_cpf),
      locatario_telefone:maskFone(formLocacao.locatario_telefone),
      contrato_inicio:formLocacao.contrato_inicio,
      contrato_fim:formLocacao.contrato_fim,
      contrato_arquivo_nome:formLocacao.contrato_arquivo_nome,
      contrato_arquivo_base64:formLocacao.contrato_arquivo_base64,
      observacoes:formLocacao.observacoes,
    });
    setAlugarModal(null);
  };

  const desocuparSala = async (sala) => {
    if(!window.confirm(`Marcar "${sala.nome}" como disponível? Os dados do locatário serão removidos.`)) return;
    await update("salas", sala.id, {
      status:"disponivel", locatario_nome:null, locatario_cpf:null, locatario_telefone:null,
      contrato_inicio:null, contrato_fim:null, contrato_arquivo_nome:null, contrato_arquivo_base64:null,
    });
  };

  const gerarCobrancaMes = async (sala) => {
    const referencia = new Date().toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
    await insert("aluguel_pagamentos",{
      sala_id:sala.id, referencia, valor:Number(sala.valor_aluguel)||0,
      vencimento:today(), status:"aberto",
    });
  };

  const confirmarBaixaPagamento = async () => {
    if(!baixaConta || !pagModal) return;
    await update("aluguel_pagamentos", pagModal.id, {status:"quitado", data_pagamento:today(), conta_id:parseInt(baixaConta)});
    setPagModal(null); setBaixaConta("");
  };

  return(
    <div>
      <PH title="Locação de Salas" sub={`${salas.length} sala(s) cadastrada(s)`}>
        <Btn onClick={()=>abrirModal(null)}><I.Plus s={12}/> Cadastrar Sala</Btn>
      </PH>

      <div className="stat-row" style={{display:"flex",gap:9,marginBottom:16,flexWrap:"wrap"}}>
        <SC label="Disponíveis" value={disponiveis} Icon={I.Check} color={C.success}/>
        <SC label="Alugadas" value={alugadas} Icon={I.User} color={C.info}/>
        <SC label="Receita Mensal Potencial" value={fmt(receitaMensal)} Icon={I.Dollar} color={C.accent}/>
        <SC label="Cobranças Pendentes" value={pagAbertos.length} Icon={I.Warn} color={C.warn}/>
      </div>

      <div className="g1" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:13,marginBottom:20}}>
        {salas.length===0&&<p style={{color:C.muted,fontSize:13}}>Nenhuma sala cadastrada ainda.</p>}
        {salas.map(sala=>(
          <div key={sala.id} className="fc" style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:13,padding:16,boxShadow:"0 1px 8px #7C5CBF0A"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div>
                <div style={{color:C.text,fontWeight:700,fontSize:14}}>{sala.nome}</div>
                <div style={{color:C.muted,fontSize:11,marginTop:2}}>{sala.descricao||"—"}</div>
              </div>
              <Badge text={sala.status==="alugada"?"Alugada":"Disponível"} color={sala.status==="alugada"?C.info:C.success}/>
            </div>
            <div style={{color:C.accent,fontWeight:700,fontSize:16,marginBottom:10}}>{fmt(sala.valor_aluguel)}<span style={{color:C.muted,fontSize:11,fontWeight:400}}>/mês</span></div>

            {sala.status==="alugada"&&<div style={{background:C.surface,borderRadius:9,padding:11,marginBottom:11}}>
              <div style={{color:C.text,fontSize:12,fontWeight:600}}>{sala.locatario_nome}</div>
              <div style={{color:C.muted,fontSize:10,marginTop:2}}>CPF: {sala.locatario_cpf||"—"}</div>
              <div style={{color:C.muted,fontSize:10}}>Tel: {sala.locatario_telefone||"—"}</div>
              <div style={{color:C.muted,fontSize:10,marginTop:3}}>Contrato: {fmtDate(sala.contrato_inicio)} até {sala.contrato_fim?fmtDate(sala.contrato_fim):"indeterminado"}</div>
              {sala.contrato_arquivo_base64&&
                <a href={sala.contrato_arquivo_base64} download={sala.contrato_arquivo_nome} style={{display:"inline-flex",alignItems:"center",gap:5,marginTop:7,color:C.accent,fontSize:11,textDecoration:"none"}}>
                  <I.File c={C.accent} s={12}/> {sala.contrato_arquivo_nome||"Ver contrato"}
                </a>
              }
            </div>}

            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {sala.status==="disponivel"
                ? <Btn onClick={()=>abrirAlugar(sala)} style={{flex:1,justifyContent:"center",fontSize:11}}><I.Plus s={11}/> Alugar</Btn>
                : <>
                    <Btn v="ok" onClick={()=>gerarCobrancaMes(sala)} style={{fontSize:11}}><I.Dollar s={11}/> Gerar Cobrança</Btn>
                    <Btn v="d" onClick={()=>desocuparSala(sala)} style={{fontSize:11}}>Desocupar</Btn>
                  </>
              }
              <Btn v="g" onClick={()=>abrirModal(sala)} style={{padding:"6px 9px"}}><I.Edit s={12}/></Btn>
            </div>
          </div>
        ))}
      </div>

      {/* PAGAMENTOS DE ALUGUEL */}
      <h3 style={{color:C.text,fontSize:14,fontWeight:700,marginBottom:11}}>Cobranças de Aluguel</h3>
      <ST cols={["Sala","Referência","Vencimento","Valor","Status","Ação"]}
        rows={pagamentos.sort((a,b)=>(b.vencimento||"").localeCompare(a.vencimento||"")).map(p=>{
          const sala = salas.find(s=>s.id===p.sala_id);
          return [
            <span style={{fontWeight:600}}>{sala?.nome||"—"}</span>,
            <span style={{fontSize:11}}>{p.referencia}</span>,
            <span style={{fontSize:11,color:p.status==="aberto"&&p.vencimento<today()?C.danger:C.text}}>{fmtDate(p.vencimento)}</span>,
            <span style={{color:C.accent,fontWeight:700}}>{fmt(p.valor)}</span>,
            <Badge text={p.status==="quitado"?"Recebido":"Aberto"} color={p.status==="quitado"?C.success:C.warn}/>,
            p.status==="aberto"?<Btn v="ok" onClick={()=>setPagModal(p)} style={{padding:"3px 9px",fontSize:10}}>Receber</Btn>:<span style={{fontSize:10,color:C.muted}}>{fmtDate(p.data_pagamento)}</span>,
          ];
        })}
        empty="Nenhuma cobrança gerada ainda. Clique em 'Gerar Cobrança' numa sala alugada."
      />

      {modal&&<Mod title={editing?"Editar Sala":"Nova Sala"} onClose={()=>setModal(false)}>
        <Inp label="Nome da sala" value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} placeholder="Ex: Sala 1 - Estética Facial"/>
        <TA label="Descrição" value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))} placeholder="Metragem, equipamentos disponíveis..."/>
        <Inp label="Valor do aluguel (R$/mês)" type="number" value={form.valor_aluguel} onChange={e=>setForm(f=>({...f,valor_aluguel:e.target.value}))}/>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Btn v="g" onClick={()=>setModal(false)}>Cancelar</Btn>
          <Btn onClick={salvar} disabled={!form.nome}><I.Check s={12}/> Salvar</Btn>
        </div>
      </Mod>}

      {alugarModal&&<Mod title={`Alugar — ${alugarModal.nome}`} onClose={()=>setAlugarModal(null)} wide>
        <Inp label="Nome do locatário" value={formLocacao.locatario_nome} onChange={e=>setFormLocacao(f=>({...f,locatario_nome:e.target.value}))}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Inp label="CPF" value={formLocacao.locatario_cpf} onChange={e=>setFormLocacao(f=>({...f,locatario_cpf:maskCPF(e.target.value)}))} placeholder="000.000.000-00"/>
          <Inp label="Telefone" value={formLocacao.locatario_telefone} onChange={e=>setFormLocacao(f=>({...f,locatario_telefone:maskFone(e.target.value)}))} placeholder="(11) 99999-9999"/>
          <Inp label="Início do contrato" type="date" value={formLocacao.contrato_inicio} onChange={e=>setFormLocacao(f=>({...f,contrato_inicio:e.target.value}))}/>
          <Inp label="Fim do contrato (opcional)" type="date" value={formLocacao.contrato_fim} onChange={e=>setFormLocacao(f=>({...f,contrato_fim:e.target.value}))}/>
        </div>
        <div style={{marginBottom:11}}>
          <label style={{display:"block",color:C.muted,fontSize:10,letterSpacing:.9,textTransform:"uppercase",marginBottom:4}}>Contrato de locação (PDF ou imagem)</label>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <label style={{flex:1,background:C.surface,border:`1px dashed ${C.border}`,borderRadius:8,padding:"9px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:7,color:C.muted,fontSize:12}}>
              <I.File c={C.muted} s={14}/>
              {uploadNome||"Escolher arquivo..."}
              <input type="file" accept=".pdf,image/*" onChange={handleUploadContrato} style={{display:"none"}}/>
            </label>
          </div>
        </div>
        <TA label="Observações" value={formLocacao.observacoes} onChange={e=>setFormLocacao(f=>({...f,observacoes:e.target.value}))}/>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Btn v="g" onClick={()=>setAlugarModal(null)}>Cancelar</Btn>
          <Btn onClick={confirmarLocacao} disabled={!formLocacao.locatario_nome}><I.Check s={12}/> Confirmar Locação</Btn>
        </div>
      </Mod>}

      {pagModal&&<Mod title="Receber Aluguel" onClose={()=>{setPagModal(null);setBaixaConta("");}}>
        <div style={{background:C.surface,borderRadius:9,padding:12,marginBottom:13}}>
          <div style={{color:C.muted,fontSize:11,marginBottom:3}}>Referência: {pagModal.referencia}</div>
          <div style={{color:C.text,fontWeight:700,fontSize:18}}>{fmt(pagModal.valor)}</div>
        </div>
        <Sel label="Receber em qual conta?" value={baixaConta} onChange={e=>setBaixaConta(e.target.value)} options={[{value:"",label:"Selecione..."}, ...data.contas_bancarias.map(c=>({value:c.id,label:c.nome}))]}/>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Btn v="g" onClick={()=>{setPagModal(null);setBaixaConta("");}}>Cancelar</Btn>
          <Btn v="ok" onClick={confirmarBaixaPagamento} disabled={!baixaConta}><I.Check s={12}/> Confirmar Recebimento</Btn>
        </div>
      </Mod>}
    </div>
  );
}

function Comissoes({data, update, user}) {
  const isSupervisor = !user || user.role !== "profissional";
  const [aba,setAba] = useState("pendentes");
  const [baixaModal,setBaixaModal] = useState(null);
  const [baixaConta,setBaixaConta] = useState("");
  const [filt,setFilt] = useState({profissional:"",de:"",ate:""});
  const ff = (k,v) => setFilt(p=>({...p,[k]:v}));

  const todas = useMemo(()=>{
    let l = [...(data.comissoes||[])];
    /* Profissional só vê as próprias */
    if(!isSupervisor) l = l.filter(c=>c.profissional_id===user.profissionalId);
    if(filt.profissional) l = l.filter(c=>String(c.profissional_id)===filt.profissional);
    if(filt.de) l = l.filter(c=>c.data_atendimento>=filt.de);
    if(filt.ate) l = l.filter(c=>c.data_atendimento<=filt.ate);
    return l.sort((a,b)=>(b.data_atendimento||"").localeCompare(a.data_atendimento||""));
  },[data.comissoes,filt,isSupervisor,user]);

  const pendentes = todas.filter(c=>c.status==="pendente");
  const pagas = todas.filter(c=>c.status==="paga");
  const totalPendente = pendentes.reduce((s,c)=>s+(Number(c.valor_comissao)||0),0);
  const totalPago = pagas.reduce((s,c)=>s+(Number(c.valor_comissao)||0),0);

  const confirmarBaixa = async () => {
    if(!baixaConta) return;
    await update("comissoes", baixaModal.id, {
      status:"paga", data_pagamento:today(), conta_id:parseInt(baixaConta),
    });
    setBaixaModal(null); setBaixaConta("");
  };

  const lista = aba==="pendentes" ? pendentes : pagas;

  return(
    <div>
      <PH title={isSupervisor?"Comissões":"Minhas Comissões"} sub={isSupervisor?"Controle de comissões por profissional":"Seus valores a receber e já recebidos"}/>

      <div className="stat-row" style={{display:"flex",gap:9,marginBottom:14,flexWrap:"wrap"}}>
        <SC label="A Pagar / A Receber" value={fmt(totalPendente)} Icon={I.Warn} color={C.warn} sub={`${pendentes.length} atendimento(s)`}/>
        <SC label="Já Pagas / Recebidas" value={fmt(totalPago)} Icon={I.Check} color={C.success} sub={`${pagas.length} atendimento(s)`}/>
      </div>

      {isSupervisor&&<FilterBar filters={[
        {key:"profissional",type:"select",label:"Profissional",options:data.profissionais.map(p=>({value:String(p.id),label:p.nome}))},
        {key:"de",type:"date",label:"De"},
        {key:"ate",type:"date",label:"Até"},
      ]} values={filt} onChange={ff}/>}

      <div style={{display:"flex",gap:8,marginBottom:13}}>
        {[["pendentes",isSupervisor?"A Pagar":"A Receber",pendentes.length,C.warn],["pagas",isSupervisor?"Pagas":"Recebidas",pagas.length,C.success]].map(([id,label,qtd,cor])=>(
          <button key={id} onClick={()=>setAba(id)} style={{padding:"7px 16px",borderRadius:8,border:`1px solid ${aba===id?cor:C.border}`,background:aba===id?cor+"14":"transparent",color:aba===id?cor:C.muted,fontSize:12,fontWeight:aba===id?700:400,cursor:"pointer"}}>
            {label} ({qtd})
          </button>
        ))}
      </div>

      <ST cols={isSupervisor?["Profissional","Paciente","Procedimento","Data","Valor Atend.","%","Comissão","Status","Ação"]:["Paciente","Procedimento","Data","Valor Atend.","%","Comissão","Status"]}
        rows={lista.map(c=>{
          const prof = data.profissionais.find(p=>p.id===c.profissional_id);
          const base = [
            ...(isSupervisor?[<span style={{fontWeight:600,color:prof?.cor||C.text}}>{prof?.nome||"—"}</span>]:[]),
            <span style={{fontSize:12}}>{c.paciente}</span>,
            <span style={{fontSize:11,color:C.muted}}>{c.servico}</span>,
            <span style={{fontSize:11}}>{fmtDate(c.data_atendimento)}</span>,
            <span style={{color:C.text,fontSize:11}}>{fmt(c.valor_atendimento)}</span>,
            <span style={{color:C.info,fontSize:11}}>{fmtN(c.percentual)}%</span>,
            <span style={{color:c.status==="paga"?C.success:C.warn,fontWeight:700}}>{fmt(c.valor_comissao)}</span>,
          ];
          if(isSupervisor){
            base.push(<Badge text={c.status==="paga"?"Paga":"Pendente"} color={c.status==="paga"?C.success:C.warn}/>);
            base.push(c.status==="pendente"
              ? <Btn v="ok" onClick={()=>setBaixaModal(c)} style={{padding:"3px 9px",fontSize:10}}>Pagar</Btn>
              : <span style={{fontSize:10,color:C.muted}}>{fmtDate(c.data_pagamento)}</span>
            );
          } else {
            base.push(<Badge text={c.status==="paga"?"Recebida":"Pendente"} color={c.status==="paga"?C.success:C.warn}/>);
          }
          return base;
        })}
        empty={aba==="pendentes"?"Nenhuma comissão pendente.":"Nenhuma comissão paga ainda."}
      />

      {baixaModal&&<Mod title={`Pagar Comissão — ${data.profissionais.find(p=>p.id===baixaModal.profissional_id)?.nome}`} onClose={()=>{setBaixaModal(null);setBaixaConta("");}}>
        <div style={{background:C.surface,borderRadius:9,padding:12,marginBottom:13}}>
          <div style={{color:C.muted,fontSize:11,marginBottom:3}}>Valor da comissão:</div>
          <div style={{color:C.text,fontWeight:700,fontSize:18}}>{fmt(baixaModal.valor_comissao)}</div>
          <div style={{color:C.muted,fontSize:11,marginTop:3}}>{baixaModal.servico} — {baixaModal.paciente}</div>
        </div>
        <Sel label="Pagar de qual conta?" value={baixaConta} onChange={e=>setBaixaConta(e.target.value)} options={[{value:"",label:"Selecione a conta..."}, ...data.contas_bancarias.map(c=>({value:c.id,label:`${c.nome} (${c.tipo})`}))]}/>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Btn v="g" onClick={()=>{setBaixaModal(null);setBaixaConta("");}}>Cancelar</Btn>
          <Btn v="ok" onClick={confirmarBaixa} disabled={!baixaConta}><I.Check s={12}/> Confirmar Pagamento</Btn>
        </div>
      </Mod>}
    </div>
  );
}

/* ─── CHAT IA ────────────────────────────────────────────────── */
function ChatIA({data, user}) {
  const isSupervisor = !user || user.role !== "profissional";
  const [msgs,setMsgs]=useState([{role:"assistant",text:isSupervisor?"Olá! Sou o assistente IA do VPBeauty. Tenho acesso aos dados reais da sua clínica — receita, pacientes, estoque e procedimentos. Como posso ajudar?":`Olá, ${user?.nome||""}! Posso te ajudar com informações sobre sua agenda, seus pacientes e seus atendimentos. Como posso ajudar?`}]);
  const [input,setInput]=useState("");const [loading,setLoading]=useState(false);const endRef=useRef(null);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);
  const sug=isSupervisor
    ? ["Análise financeira do mês","Quais serviços são mais rentáveis?","Pacientes em risco de churn?","Como aumentar o ticket médio?","Estoque crítico?","Profissional mais produtivo?"]
    : ["Meus agendamentos de hoje","Quais pacientes tenho essa semana?","Meu histórico de atendimentos","Quais pacientes não voltam há tempo?"];
  const enviar=async()=>{
    if(!input.trim()||loading)return;
    const msg=input.trim();setInput("");setLoading(true);
    setMsgs(m=>[...m,{role:"user",text:msg}]);
    const rec=data.atendimentos.reduce((s,a)=>s+(Number(a.valor_final||a.valor)||0),0);
    let ctx;
    if(isSupervisor){
      const desp=(data.contas_pagar||[]).reduce((s,d)=>s+(Number(d.valor)||0),0);
      const critico=data.produtos.filter(p=>p.estoque_atual<=p.estoque_minimo).map(p=>p.nome);
      const vips=data.pacientes.filter(p=>(p.total_gasto||0)>3000);
      ctx=`Você é a IA de gestão da clínica de estética avançada "${data?.clinica||"VPBeauty"}". 
Dados atuais:
- Profissionais: ${data.profissionais.map(p=>`${p.nome} (${p.especialidade})`).join("; ")}
- Procedimentos: ${data.procedimentos.map(p=>`${p.nome} R$${p.preco_venda} margem ${p.margem}%`).join("; ")}
- Receita total: R$${rec.toFixed(2)} | Despesas: R$${desp.toFixed(2)} | Lucro: R$${(rec-desp).toFixed(2)}
- Atendimentos: ${data.atendimentos.length} | Pacientes: ${data.pacientes.length} | VIPs: ${vips.length}
- Estoque crítico: ${critico.length>0?critico.join(", "):"nenhum"}
- Agendamentos hoje: ${data.agendamentos.filter(a=>a.data===today()).length}
Responda em português, seja analítico e objetivo. Máx 4 frases. Use dados concretos quando possível.`;
    } else {
      /* Contexto restrito: apenas os dados do próprio profissional, já filtrados antes de chegar aqui */
      ctx=`Você é a IA de apoio para ${user?.nome||"o(a) profissional"}, que atende na clínica "${data?.clinica||"VPBeauty"}".
IMPORTANTE: Você só tem acesso e só deve falar sobre os dados DESTE profissional específico — nunca revele, estime ou mencione dados de outros profissionais, financeiro geral da clínica, ou informações fora deste escopo. Se perguntarem algo fora desse escopo, explique educadamente que essa informação não está disponível no seu nível de acesso.
Dados disponíveis (apenas deste profissional):
- Meus agendamentos: ${data.agendamentos.length} (hoje: ${data.agendamentos.filter(a=>a.data===today()).length})
- Meus atendimentos realizados: ${data.atendimentos.length} | Minha receita gerada: R$${rec.toFixed(2)}
- Meus pacientes: ${data.pacientes.map(p=>p.nome).join(", ")||"nenhum ainda"}
Responda em português, de forma direta e objetiva. Máx 4 frases.`;
    }
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:ctx,messages:[...msgs.filter((_,i)=>i>0).map(m=>({role:m.role,content:m.text})),{role:"user",content:msg}]})});
      const json=await res.json();
      setMsgs(m=>[...m,{role:"assistant",text:json.content?.[0]?.text||"Não consegui processar."}]);
    }catch{setMsgs(m=>[...m,{role:"assistant",text:"Erro de conexão com a IA."}]);}
    setLoading(false);
  };
  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 120px)"}}>
      <PH title="Assistente IA" sub={isSupervisor?"Conectado aos dados reais da clínica":"Restrito aos seus dados"}/>
      <div style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:13,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{flex:1,overflowY:"auto",padding:13}}>
          {msgs.map((m,i)=>(
            <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",marginBottom:10,gap:7,alignItems:"flex-end"}}>
              {m.role==="assistant"&&<div style={{width:26,height:26,borderRadius:"50%",background:C.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><I.Sparkle c={C.accent} s={12}/></div>}
              <div style={{maxWidth:"75%",background:m.role==="user"?C.accent:C.surface,color:m.role==="user"?"#FFFFFF":C.text,padding:"9px 13px",borderRadius:m.role==="user"?"12px 12px 4px 12px":"12px 12px 12px 4px",fontSize:12,lineHeight:1.6,border:m.role==="user"?"none":`1px solid ${C.border}`}}>{m.text}</div>
            </div>
          ))}
          {loading&&<div style={{display:"flex",gap:7,alignItems:"flex-end"}}><div style={{width:26,height:26,borderRadius:"50%",background:C.accentSoft,display:"flex",alignItems:"center",justifyContent:"center"}}><I.Sparkle c={C.accent} s={12}/></div><div style={{background:C.surface,padding:"9px 13px",borderRadius:"12px 12px 12px 4px",color:C.muted,fontSize:12,display:"flex",gap:5,alignItems:"center"}}><Spin c={C.muted} s={12}/>Analisando dados...</div></div>}
          <div ref={endRef}/>
        </div>
        {msgs.length===1&&<div style={{padding:"0 12px 10px",display:"flex",gap:5,flexWrap:"wrap"}}>{sug.map(s=><button key={s} onClick={()=>setInput(s)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,padding:"4px 10px",color:C.muted,fontSize:10,cursor:"pointer"}}>{s}</button>)}</div>}
        <div style={{padding:"9px 11px",borderTop:`1px solid ${C.border}`,display:"flex",gap:7}}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&enviar()} placeholder="Pergunte sobre sua clínica..." style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 12px",color:C.text,fontSize:13}}/>
          <button onClick={enviar} disabled={loading||!input.trim()} style={{background:C.accent,border:"none",borderRadius:9,padding:"9px 12px",cursor:"pointer",opacity:loading||!input.trim()?0.5:1}}><I.Send c="#FFFFFF" s={14}/></button>
        </div>
      </div>
    </div>
  );
}


/* ─── LANDING PAGE ───────────────────────────────────────────── */
/* ─── PROGRAMA DE AFILIADOS ──────────────────────────────────────
   Contrato gerado dinamicamente com os dados do afiliado no momento
   da assinatura. Este texto é um rascunho funcional — recomenda-se
   revisão jurídica antes do uso comercial oficial.                */
const gerarTextoContratoAfiliado = ({nome, cpf, email, codigo, percentual, valorMinimo, mesesInatividade}) => `
CONTRATO DE ADESÃO AO PROGRAMA DE INDICAÇÃO VPBEAUTY

Pelo presente instrumento particular, de um lado VIRTUALPLAN, doravante denominada "VPBEAUTY", e de outro lado ${nome}, portador(a) do CPF ${cpf}, e-mail ${email}, doravante denominado(a) "AFILIADO(A)", têm entre si justo e acordado o seguinte:

1. OBJETO
1.1. O presente contrato tem por objeto a adesão do(a) AFILIADO(A) ao Programa de Indicação VPBeauty, por meio do qual o(a) AFILIADO(A) poderá indicar novos clientes ao sistema VPBeauty utilizando seu código pessoal de afiliado: ${codigo}.

2. NATUREZA DA RELAÇÃO
2.1. O presente contrato caracteriza exclusivamente um programa de indicação, não configurando, em nenhuma hipótese, vínculo empregatício, societário, de representação comercial ou qualquer outra relação de subordinação entre as partes.
2.2. O(A) AFILIADO(A) atua de forma autônoma e independente, não possuindo poderes para representar, contratar ou assumir obrigações em nome da VPBeauty.

3. COMISSIONAMENTO
3.1. O(A) AFILIADO(A) fará jus a uma comissão de ${percentual}% (${percentual} por cento) sobre o valor efetivamente pago por cada cliente indicado através de seu código pessoal, enquanto este permanecer com assinatura ativa junto à VPBeauty.
3.2. A comissão é vitalícia enquanto durar a assinatura do cliente indicado. Caso o cliente indicado cancele, deixe de pagar ou encerre sua assinatura, a comissão correspondente cessa a partir desse momento, não gerando qualquer direito adquirido ao(à) AFILIADO(A) sobre pagamentos futuros daquele cliente.
3.3. Os valores de comissão devidos serão apurados e disponibilizados na área do(a) AFILIADO(A) no sistema.

4. PAGAMENTO DAS COMISSÕES
4.1. O pagamento das comissões acumuladas será realizado via Pix, na chave cadastrada pelo(a) AFILIADO(A), somente quando o saldo disponível atingir o valor mínimo de R$ ${valorMinimo} (${valorMinimo} reais).
4.2. Saldos inferiores ao valor mínimo permanecem acumulados até que o patamar seja atingido, não havendo prazo máximo de acúmulo, exceto em caso de descredenciamento nos termos da cláusula 6.

5. FALECIMENTO DO AFILIADO
5.1. Em caso de falecimento do(a) AFILIADO(A), o presente contrato se extingue automaticamente, e os direitos de comissionamento aqui previstos não se transferem, sob qualquer forma, a herdeiros, sucessores ou terceiros.

6. DESCREDENCIAMENTO
6.1. O(A) AFILIADO(A) que permanecer ${mesesInatividade} (${mesesInatividade}) meses consecutivos sem realizar nenhuma nova indicação válida poderá ser descredenciado(a) do Programa, a critério exclusivo da VPBeauty, mediante comunicação prévia.
6.2. O descredenciamento não afeta o direito ao recebimento de comissões já apuradas e ainda não pagas até a data do desligamento, respeitado o valor mínimo de saque previsto na cláusula 4.1.

7. DISPOSIÇÕES GERAIS
7.1. A VPBeauty poderá alterar as condições deste Programa a qualquer tempo, mediante comunicação ao(à) AFILIADO(A), sendo a permanência no Programa após a comunicação interpretada como aceite às novas condições.
7.2. Este contrato é regido pelas leis brasileiras, elegendo as partes o foro do domicílio da VPBeauty para dirimir eventuais controvérsias.

Ao assinar digitalmente abaixo, o(a) AFILIADO(A) declara ter lido, compreendido e aceitado integralmente os termos deste contrato.
`.trim();

function CadastroAfiliadoModal({onClose, onSuccess}) {
  const [etapa,setEtapa]=useState(1);
  const [form,setForm]=useState({nome:"",cpf:"",email:"",telefone:"",senha:"",chave_pix:"",tipo_chave_pix:"cpf"});
  const [assinatura,setAssinatura]=useState("");
  const [showSig,setShowSig]=useState(false);
  const [erro,setErro]=useState("");
  const [loading,setLoading]=useState(false);
  const f=(k,v)=>setForm(p=>({...p,[k]:v}));

  const gerarCodigo = (nome) => {
    const base = nome.trim().split(" ")[0].toUpperCase().replace(/[^A-Z]/g,"").slice(0,8);
    return `${base}${Math.floor(1000+Math.random()*9000)}`;
  };

  const percentualPadrao = 20, valorMinimoPadrao = 200, mesesInatividadePadrao = 6;
  const [codigoGerado,setCodigoGerado] = useState("");

  const validarEtapa1 = () => {
    if(!form.nome.trim()) return "Informe seu nome completo.";
    if(!form.cpf.trim()) return "Informe seu CPF.";
    if(!form.email.trim()) return "Informe seu e-mail.";
    if(!form.senha||form.senha.length<6) return "A senha precisa ter ao menos 6 caracteres.";
    if(!form.chave_pix.trim()) return "Informe sua chave Pix para recebimento.";
    return "";
  };

  const avancar = () => {
    const err = validarEtapa1();
    if(err){ setErro(err); return; }
    setErro("");
    /* Gera o código UMA vez — o mesmo exibido no contrato deve ser o salvo ao final */
    if(!codigoGerado) setCodigoGerado(gerarCodigo(form.nome));
    setEtapa(2);
  };

  const finalizarCadastro = async () => {
    if(!assinatura){ setErro("Assine o contrato para concluir o cadastro."); return; }
    setLoading(true); setErro("");
    const codigo = codigoGerado;
    const textoContrato = gerarTextoContratoAfiliado({
      nome:form.nome, cpf:maskCPF(form.cpf), email:form.email, codigo,
      percentual:percentualPadrao, valorMinimo:valorMinimoPadrao, mesesInatividade:mesesInatividadePadrao,
    });

    if(DEMO_MODE){
      await new Promise(r=>setTimeout(r,900));
      setLoading(false);
      onSuccess({codigo});
      return;
    }
    const res = await sb.cadastrarAfiliado({
      nome:form.nome, cpf:maskCPF(form.cpf), email:form.email, telefone:maskFone(form.telefone),
      senha:form.senha, chavePix:form.chave_pix, tipoChavePix:form.tipo_chave_pix, codigo,
      textoContrato, assinaturaBase64:assinatura,
    });
    setLoading(false);
    if(res.erro){ setErro(res.erro); return; }
    onSuccess({codigo});
  };

  return(
    <div style={{position:"fixed",inset:0,background:"#4A3D6280",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(4px)"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="fu" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,width:"100%",maxWidth:540,maxHeight:"92vh",overflowY:"auto"}}>
        <div style={{padding:"20px 24px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div className="cm" style={{fontSize:17,fontWeight:600,color:T.text}}>Seja uma Afiliada VPBeauty</div>
            <div style={{color:T.mutedLt,fontSize:11,marginTop:2}}>{etapa===1?"Seus dados":"Contrato de adesão"}</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:T.muted}}><I.X c={T.muted} s={18}/></button>
        </div>

        <div style={{padding:24}}>
          {etapa===1&&<>
            <Inp label="Nome completo" value={form.nome} onChange={e=>f("nome",e.target.value)} placeholder="Seu nome completo"/>
            <Inp label="CPF" value={form.cpf} onChange={e=>f("cpf",maskCPF(e.target.value))} placeholder="000.000.000-00"/>
            <Inp label="E-mail" type="email" value={form.email} onChange={e=>f("email",e.target.value)} placeholder="seu@email.com"/>
            <Inp label="WhatsApp" value={form.telefone} onChange={e=>f("telefone",maskFone(e.target.value))} placeholder="(11) 99999-9999"/>
            <Inp label="Senha de acesso" type="password" value={form.senha} onChange={e=>f("senha",e.target.value)} placeholder="Mín. 6 caracteres"/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Sel label="Tipo de chave Pix" value={form.tipo_chave_pix} onChange={e=>f("tipo_chave_pix",e.target.value)} options={[{value:"cpf",label:"CPF"},{value:"email",label:"E-mail"},{value:"telefone",label:"Telefone"},{value:"aleatoria",label:"Chave aleatória"}]}/>
              <Inp label="Chave Pix" value={form.chave_pix} onChange={e=>f("chave_pix",e.target.value)} placeholder="Sua chave para receber"/>
            </div>
            {erro&&<div style={{background:T.danger+"14",border:`1px solid ${T.danger}30`,borderRadius:8,padding:"9px 12px",marginTop:4,marginBottom:10,color:T.danger,fontSize:12}}>{erro}</div>}
            <button className="gb" onClick={avancar} style={{width:"100%",background:T.gold,color:"#FFFFFF",border:"none",borderRadius:9,padding:"12px",fontWeight:700,fontSize:13,cursor:"pointer",marginTop:8}}>Continuar para o contrato →</button>
          </>}

          {etapa===2&&<>
            <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,padding:14,maxHeight:280,overflowY:"auto",marginBottom:14}}>
              <pre style={{color:T.mutedLt,fontSize:10.5,lineHeight:1.7,whiteSpace:"pre-wrap",fontFamily:"inherit",margin:0}}>
                {gerarTextoContratoAfiliado({nome:form.nome,cpf:maskCPF(form.cpf),email:form.email,codigo:codigoGerado,percentual:percentualPadrao,valorMinimo:valorMinimoPadrao,mesesInatividade:mesesInatividadePadrao})}
              </pre>
            </div>

            {!assinatura ? <>
              {!showSig
                ? <button className="ob" onClick={()=>setShowSig(true)} style={{width:"100%",background:"transparent",color:T.gold,border:`1px solid ${T.gold}50`,borderRadius:9,padding:"11px",fontWeight:600,fontSize:12,cursor:"pointer"}}>✍️ Assinar contrato digitalmente</button>
                : <SignaturePad onSave={(b64)=>{setAssinatura(b64);setShowSig(false);}} onCancel={()=>setShowSig(false)}/>
              }
            </> : <div style={{background:T.success+"10",border:`1px solid ${T.success}30`,borderRadius:9,padding:"10px 14px",display:"flex",alignItems:"center",gap:8}}>
              <I.Check c={T.success} s={16}/>
              <span style={{color:T.success,fontSize:12,fontWeight:600}}>Contrato assinado digitalmente</span>
              <button onClick={()=>setAssinatura("")} style={{marginLeft:"auto",background:"none",border:"none",color:T.muted,fontSize:11,cursor:"pointer"}}>Assinar de novo</button>
            </div>}

            {erro&&<div style={{background:T.danger+"14",border:`1px solid ${T.danger}30`,borderRadius:8,padding:"9px 12px",marginTop:10,color:T.danger,fontSize:12}}>{erro}</div>}

            <div style={{display:"flex",gap:8,marginTop:16}}>
              <button onClick={()=>setEtapa(1)} style={{flex:1,background:"transparent",color:T.mutedLt,border:`1px solid ${T.border}`,borderRadius:9,padding:"11px",fontWeight:500,fontSize:12,cursor:"pointer"}}>Voltar</button>
              <button className="gb gl" onClick={finalizarCadastro} disabled={loading||!assinatura} style={{flex:2,background:T.gold,color:"#FFFFFF",border:"none",borderRadius:9,padding:"11px",fontWeight:700,fontSize:13,cursor:"pointer",opacity:loading||!assinatura?0.6:1}}>
                {loading?"Cadastrando...":"Concluir cadastro →"}
              </button>
            </div>
          </>}
        </div>
      </div>
    </div>
  );
}

/* ─── ÁREA DA AFILIADA ───────────────────────────────────────── */
function AreaAfiliado({user, onLogout}) {
  const [indicacoes,setIndicacoes] = useState([]);
  const [saques,setSaques] = useState([]);
  const [config,setConfig] = useState({afiliado_valor_minimo_saque:200});
  const [loading,setLoading] = useState(true);
  const [modalSaque,setModalSaque] = useState(false);
  const [msgSaque,setMsgSaque] = useState("");

  const carregar = async () => {
    setLoading(true);
    if(DEMO_MODE){
      setIndicacoes([
        {id:1,clinica_nome:"Studio Bella Vitta",valor_assinatura:399,comissao_valor:79.8,status:"pendente",referencia:"Junho/2026",created_at:"2026-06-05"},
        {id:2,clinica_nome:"Espaço Renovare",valor_assinatura:3990,comissao_valor:798,status:"paga",referencia:"Maio/2026",created_at:"2026-05-12"},
      ]);
      setSaques([{id:1,valor:798,status:"pago",data_solicitacao:"2026-05-20",data_pagamento:"2026-05-22"}]);
      setConfig({afiliado_valor_minimo_saque:200});
      setLoading(false);
      return;
    }
    try {
      const [ind, saq, cfg] = await Promise.all([
        sb.get("afiliado_indicacoes", `afiliado_id=eq.${user.afiliadoId}&order=created_at.desc`),
        sb.get("afiliado_saques", `afiliado_id=eq.${user.afiliadoId}&order=data_solicitacao.desc`),
        sb.get("config_sistema",""),
      ]);
      setIndicacoes(ind||[]); setSaques(saq||[]);
      if(cfg?.[0]) setConfig(cfg[0]);
    } catch(e){ console.error(e); }
    setLoading(false);
  };
  useEffect(()=>{ carregar(); },[]); // eslint-disable-line

  const totalPendente = indicacoes.filter(i=>i.status==="pendente").reduce((s,i)=>s+(Number(i.comissao_valor)||0),0);
  const totalPago = indicacoes.filter(i=>i.status==="paga").reduce((s,i)=>s+(Number(i.comissao_valor)||0),0);
  const totalSacado = saques.filter(s=>s.status==="pago").reduce((s,x)=>s+(Number(x.valor)||0),0);
  const saldoDisponivel = totalPago - totalSacado;
  const valorMinimo = Number(config.afiliado_valor_minimo_saque)||200;
  const podeSacar = saldoDisponivel >= valorMinimo;

  const linkIndicacao = typeof window!=="undefined" ? `${window.location.origin}?ref=${user.codigo}` : "";
  const [copiado,setCopiado] = useState(false);
  const copiarLink = () => { navigator.clipboard?.writeText(linkIndicacao); setCopiado(true); setTimeout(()=>setCopiado(false),2000); };

  const solicitarSaque = async () => {
    if(!podeSacar) return;
    setMsgSaque("");
    if(DEMO_MODE){ setMsgSaque("✓ Saque solicitado (modo demo)."); setModalSaque(false); return; }
    try {
      await sb.post("afiliado_saques", {afiliado_id:user.afiliadoId, valor:saldoDisponivel, status:"solicitado"});
      setMsgSaque("✓ Saque solicitado! Você será avisada quando o Pix for enviado.");
      setModalSaque(false);
      carregar();
    } catch(e){ setMsgSaque("Erro ao solicitar saque."); }
  };

  if(loading) return (
    <div style={{display:"flex",height:"100vh",background:C.bg,alignItems:"center",justifyContent:"center",fontFamily:"'Inter',sans-serif"}}>
      <div style={{textAlign:"center"}}><div className="sp" style={{width:40,height:40,border:`3px solid ${C.accent}25`,borderTop:`3px solid ${C.accent}`,borderRadius:"50%",margin:"0 auto 14px"}}/><div style={{color:C.muted,fontSize:13}}>Carregando sua área...</div></div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Inter',sans-serif"}}>
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"14px clamp(16px,4vw,32px)",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <LogoMark size={30}/>
          <div>
            <div style={{color:C.text,fontWeight:700,fontSize:14}}>Área da Afiliada</div>
            <div style={{color:C.muted,fontSize:10}}>{user.nome}</div>
          </div>
        </div>
        <button onClick={onLogout} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 14px",color:C.muted,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
          <I.Out c={C.muted} s={13}/> Sair
        </button>
      </div>

      <div style={{padding:"clamp(16px,3vw,28px)",maxWidth:900,margin:"0 auto"}}>
        {/* Código e link */}
        <div style={{background:`linear-gradient(145deg,#FFFFFF,#FBF6E8)`,border:`1.5px solid ${C.gold}45`,borderRadius:14,padding:20,marginBottom:20}}>
          <div style={{color:C.muted,fontSize:11,marginBottom:5}}>Seu código de afiliada</div>
          <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <span className="cm" style={{fontSize:24,fontWeight:700,color:C.gold,letterSpacing:1}}>{user.codigo}</span>
          </div>
          <div style={{marginTop:12,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <input readOnly value={linkIndicacao} style={{flex:1,minWidth:200,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.text,fontSize:12}}/>
            <Btn onClick={copiarLink}>{copiado?<><I.Check s={12}/> Copiado!</>:<><I.Copy s={12}/> Copiar link</>}</Btn>
          </div>
        </div>

        {/* KPIs */}
        <div className="stat-row" style={{display:"flex",gap:11,marginBottom:20,flexWrap:"wrap"}}>
          <SC label="Saldo Disponível" value={fmt(saldoDisponivel)} Icon={I.Dollar} color={C.success}/>
          <SC label="A Confirmar" value={fmt(totalPendente)} Icon={I.Warn} color={C.warn} sub="Ainda não liberado"/>
          <SC label="Total Já Recebido" value={fmt(totalSacado)} Icon={I.Check} color={C.accent}/>
          <SC label="Clientes Indicados" value={indicacoes.length} Icon={I.User} color={C.info}/>
        </div>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
          <div style={{color:C.muted,fontSize:12}}>Valor mínimo para saque: <strong style={{color:C.text}}>{fmt(valorMinimo)}</strong></div>
          <Btn onClick={()=>setModalSaque(true)} disabled={!podeSacar}>
            <I.Dollar s={12}/> {podeSacar?"Solicitar Saque":`Faltam ${fmt(valorMinimo-saldoDisponivel)}`}
          </Btn>
        </div>
        {msgSaque&&<div style={{background:C.success+"14",border:`1px solid ${C.success}30`,borderRadius:8,padding:"9px 12px",marginBottom:14,color:C.success,fontSize:12}}>{msgSaque}</div>}

        <h3 style={{color:C.text,fontSize:14,fontWeight:700,marginBottom:11}}>Clientes Indicados</h3>
        <ST cols={["Clínica","Referência","Valor Assinatura","Sua Comissão","Status"]}
          rows={indicacoes.map(i=>[
            <span style={{fontWeight:600}}>{i.clinica_nome}</span>,
            <span style={{fontSize:11}}>{i.referencia}</span>,
            <span style={{fontSize:11}}>{fmt(i.valor_assinatura)}</span>,
            <span style={{color:C.accent,fontWeight:700}}>{fmt(i.comissao_valor)}</span>,
            <Badge text={i.status==="paga"?"Confirmada":"Pendente"} color={i.status==="paga"?C.success:C.warn}/>,
          ])}
          empty="Você ainda não tem indicações. Compartilhe seu link para começar!"
        />

        <h3 style={{color:C.text,fontSize:14,fontWeight:700,margin:"22px 0 11px"}}>Histórico de Saques</h3>
        <ST cols={["Data da Solicitação","Valor","Status","Pago em"]}
          rows={saques.map(s=>[
            fmtDate(s.data_solicitacao), <span style={{color:C.accent,fontWeight:700}}>{fmt(s.valor)}</span>,
            <Badge text={s.status==="pago"?"Pago":s.status==="rejeitado"?"Rejeitado":"Solicitado"} color={s.status==="pago"?C.success:s.status==="rejeitado"?C.danger:C.warn}/>,
            s.data_pagamento?fmtDate(s.data_pagamento):"—",
          ])}
          empty="Nenhum saque solicitado ainda."
        />
      </div>

      {modalSaque&&<Mod title="Solicitar Saque" onClose={()=>setModalSaque(false)}>
        <div style={{background:C.surface,borderRadius:9,padding:12,marginBottom:13}}>
          <div style={{color:C.muted,fontSize:11,marginBottom:3}}>Valor disponível para saque:</div>
          <div style={{color:C.success,fontWeight:700,fontSize:20}}>{fmt(saldoDisponivel)}</div>
        </div>
        <p style={{color:C.muted,fontSize:12,marginBottom:14}}>O valor será enviado via Pix na chave cadastrada no seu contrato de afiliada.</p>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Btn v="g" onClick={()=>setModalSaque(false)}>Cancelar</Btn>
          <Btn v="ok" onClick={solicitarSaque}><I.Check s={12}/> Confirmar Solicitação</Btn>
        </div>
      </Mod>}
    </div>
  );
}

function Landing({onLogin,onCheckout}) {
  const [scrolled,setScrolled]=useState(false);const [menuOpen,setMenuOpen]=useState(false);const [activeQ,setActiveQ]=useState(null);
  const [modalAfiliado,setModalAfiliado]=useState(false);
  const [afiliadoSucesso,setAfiliadoSucesso]=useState(null);
  useEffect(()=>{const fn=()=>setScrolled(window.scrollY>50);window.addEventListener("scroll",fn);return()=>window.removeEventListener("scroll",fn);},[]);
  const go=id=>{document.getElementById(id)?.scrollIntoView({behavior:"smooth"});setMenuOpen(false);};

  const feats=[
    {Icon:I.Diamond,t:"Inteligência Artificial",d:"Uma assistente que conhece sua clínica de cor — responde sobre agenda, faturamento e estoque em segundos."},
    {Icon:I.Bar,t:"Precificação Real",d:"Rateia cada despesa por atendimento. Você para de adivinhar e passa a saber, com precisão, quanto cada procedimento realmente rende."},
    {Icon:I.Cal,t:"Agenda em Mês, Semana e Dia",d:"Visualize sua rotina do jeito que preferir, com horário de trabalho e bloqueios por profissional totalmente configuráveis."},
    {Icon:I.User,t:"Ficha & Anamnese Digital",d:"Histórico completo, CPF e assinatura digital do cliente — elegância e segurança jurídica em um só lugar."},
    {Icon:I.Box,t:"Estoque Inteligente",d:"Entradas, saídas e alertas automáticos. Nunca mais seja surpreendida por um insumo em falta."},
    {Icon:I.Megaphone,t:"CRM & Lembretes por WhatsApp",d:"Segmentação de clientes e lembretes automáticos de horário — sua cliente nunca mais esquece um agendamento."},
    {Icon:I.Dollar,t:"Financeiro Completo",d:"Contas a pagar e a receber, fluxo de caixa, DRE simplificado e caixa diário com conciliação — sua clínica, sob controle total."},
    {Icon:I.Bank,t:"Comissões & Locação de Salas",d:"Calcule comissões automaticamente e administre o aluguel de salas, com contrato digital anexado."},
    {Icon:I.Grid,t:"Múltiplos Profissionais",d:"Cada profissional acessa sua própria agenda e comissões; você mantém a visão completa do negócio."},
  ];

  const depos=[
    {nome:"Camila Andrade",clinica:"Studio Éclat — São Paulo",txt:"Descobri que dois dos procedimentos mais vendidos eram, na verdade, os menos lucrativos. Ajustei os preços e o lucro cresceu 34% em um trimestre."},
    {nome:"Fernanda Mello",clinica:"Lumina Estética — Rio de Janeiro",txt:"O CRM identificou doze clientes que não voltavam há noventa dias. Enviei uma mensagem e recuperei sete. Um resultado que eu jamais alcançaria sozinha."},
    {nome:"Renata Silveira",clinica:"Atelier Renata — Belo Horizonte",txt:"A anamnese com assinatura digital trouxe uma segurança jurídica que eu não tinha antes. Elegante, rápida e absolutamente profissional."},
  ];

  const faq=[
    {q:"Posso experimentar antes de assinar?",r:"Ao assinar, você tem acesso completo e imediato ao sistema, com suporte dedicado nos primeiros sete dias para garantir que tudo funcione perfeitamente para sua rotina."},
    {q:"O que acontece se eu cancelar?",r:"Você pode cancelar quando desejar, sem burocracia. Seus dados permanecem disponíveis por trinta dias para exportação."},
    {q:"Quantas pessoas da minha equipe podem usar o sistema?",r:"Cada assinatura contempla até cinco usuários — supervisoras e profissionais, cada uma com o nível de acesso adequado à sua função."},
    {q:"O VPBeauty funciona bem no celular?",r:"Totalmente. A experiência foi pensada para o toque, com navegação nativa no iPhone e Android, sem necessidade de instalar aplicativo algum."},
    {q:"A inteligência artificial tem acesso aos meus dados reais?",r:"Sim. A assistente consulta, em tempo real, sua agenda, seu financeiro, seu estoque e o perfil de cada cliente para oferecer respostas precisas."},
    {q:"Os lembretes de horário por WhatsApp são automáticos?",r:"Sim, por meio de integração opcional. Você também pode configurar as mensagens e os horários de envio conforme a identidade da sua clínica."},
    {q:"Consigo administrar mais de uma profissional na mesma agenda?",r:"Sim. Cada profissional tem sua própria agenda, horário de trabalho e comissões, enquanto você mantém a visão consolidada do negócio inteiro."},
  ];

  const GTag2=({children})=><span style={{display:"inline-flex",alignItems:"center",gap:6,background:"#C8A96A14",border:"1px solid #C8A96A35",borderRadius:40,padding:"5px 14px",color:"#C8A96A",fontSize:11,fontWeight:600,letterSpacing:1.4,textTransform:"uppercase"}}>{children}</span>;

  return(
    <div style={{background:T.bg,minHeight:"100vh",fontFamily:"'Inter',sans-serif"}}>
      {/* NAV */}
      <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:500,background:scrolled?`${T.bg}F0`:"transparent",borderBottom:scrolled?`1px solid ${T.border}`:"1px solid transparent",backdropFilter:scrolled?"blur(18px)":"none",padding:"0 clamp(16px,5vw,52px)"}}>
        <div style={{maxWidth:1040,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center",height:58}}>
          <div style={{display:"flex",alignItems:"center",gap:9}}>
            <LogoMark size={30}/>
            <div className="cm" style={{fontSize:19,fontWeight:600,color:T.text}}>VP<span style={{color:T.gold}}>Beauty</span></div>
          </div>
          <div className="hs" style={{display:"flex",gap:24,alignItems:"center"}}>
            {[["dores","O Desafio"],["feats","A Solução"],["afiliados","Afiliadas"],["precos","Investimento"],["faq","Perguntas"]].map(([id,l])=>(
              <button key={id} className="nl" onClick={()=>go(id)} style={{background:"none",border:"none",color:T.mutedLt,fontSize:12,fontWeight:500,cursor:"pointer"}}>{l}</button>
            ))}
          </div>
          <div style={{display:"flex",gap:7,alignItems:"center"}}>
            <button onClick={onLogin} style={{background:"transparent",border:`1px solid ${T.border}`,borderRadius:8,padding:"7px 14px",color:T.mutedLt,fontSize:12,fontWeight:500,cursor:"pointer"}}>Entrar</button>
            <button className="gb hs" onClick={()=>onCheckout("anual")} style={{background:T.gold,color:"#FFFFFF",border:"none",borderRadius:8,padding:"7px 16px",fontWeight:700,fontSize:12,cursor:"pointer"}}>Assinar agora</button>
            <button onClick={()=>setMenuOpen(!menuOpen)} style={{background:"none",border:"none",color:T.mutedLt,padding:3,cursor:"pointer"}}>{menuOpen?<I.X c={T.mutedLt} s={19}/>:<I.Menu c={T.mutedLt} s={19}/>}</button>
          </div>
        </div>
        {menuOpen&&<div style={{background:T.surface,borderTop:`1px solid ${T.border}`,padding:"12px 18px"}}>
          {[["O Desafio","dores"],["A Solução","feats"],["Investimento","precos"],["Perguntas","faq"]].map(([l,id])=>(
            <button key={id} onClick={()=>go(id)} style={{display:"block",background:"none",border:"none",color:T.text,fontSize:14,padding:"9px 0",textAlign:"left",width:"100%",borderBottom:`1px solid ${T.border}`,cursor:"pointer"}}>{l}</button>
          ))}
          <div style={{display:"flex",gap:7,marginTop:10}}>
            <button onClick={()=>{onLogin();setMenuOpen(false);}} style={{flex:1,background:"transparent",border:`1px solid ${T.border}`,borderRadius:8,padding:"10px",color:T.mutedLt,fontSize:13,cursor:"pointer"}}>Entrar</button>
            <button className="gb" onClick={()=>{onCheckout("anual");setMenuOpen(false);}} style={{flex:1,background:T.gold,color:"#FFFFFF",border:"none",borderRadius:8,padding:"10px",fontWeight:700,fontSize:13,cursor:"pointer"}}>Assinar →</button>
          </div>
        </div>}
      </nav>

      {/* HERO */}
      <section style={{minHeight:"100vh",display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",padding:"100px clamp(16px,6vw,52px) 60px",textAlign:"center",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:"10%",left:"6%",width:320,height:320,borderRadius:"50%",background:`radial-gradient(circle,${T.gold}08,transparent 70%)`,pointerEvents:"none"}}/>
        <div className="fu d1"><GTag2><I.Sparkle c={T.gold} s={10}/> Feito para clínicas de estética avançada</GTag2></div>
        <h1 className="cm ht fu d2" style={{fontSize:"clamp(38px,7vw,76px)",fontWeight:300,lineHeight:1.1,color:T.text,margin:"22px 0 15px",maxWidth:820}}>Sua clínica merece uma<br/><span style={{fontStyle:"italic",color:T.gold}}>gestão à altura</span> do seu talento</h1>
        <p className="fu d3" style={{color:T.mutedLt,fontSize:"clamp(13px,2vw,16px)",lineHeight:1.75,maxWidth:500,marginBottom:34}}>Inteligência artificial, agenda inteligente, precificação precisa e um financeiro completo — tudo o que sua clínica precisa para crescer com elegância e segurança, do primeiro agendamento à fidelização.</p>
        <div className="fu d4 hero-btns" style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center",marginBottom:40}}>
          <button className="gb gl" onClick={()=>onCheckout("anual")} style={{background:T.gold,color:"#FFFFFF",border:"none",borderRadius:10,padding:"12px 26px",fontWeight:700,fontSize:14,display:"flex",alignItems:"center",gap:7,cursor:"pointer"}}>Começar agora <I.Arrow c="#FFFFFF" s={14}/></button>
          <button className="ob" onClick={onLogin} style={{background:"transparent",color:T.mutedLt,border:`1px solid ${T.border}`,borderRadius:10,padding:"12px 22px",fontWeight:500,fontSize:13,cursor:"pointer"}}>Já sou cliente → Entrar</button>
        </div>
        <div className="fu d5" style={{display:"flex",gap:30,flexWrap:"wrap",justifyContent:"center"}}>
          {[["+34%","lucro médio em 90 dias"],["-5h","de trabalho manual por semana"],["14","módulos integrados"],["100%","pensado para o mobile"]].map(([v,l])=>(
            <div key={l} style={{textAlign:"center"}}><div className="cm" style={{fontSize:22,fontWeight:600,color:T.gold}}>{v}</div><div style={{color:T.muted,fontSize:11,marginTop:2}}>{l}</div></div>
          ))}
        </div>
      </section>

      {/* O DESAFIO (dores) */}
      <section id="dores" style={{padding:"66px clamp(16px,6vw,52px)",background:T.surface,borderTop:`1px solid ${T.border}`}}>
        <div style={{maxWidth:920,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:40}}><GTag2>O desafio de gerir com beleza e precisão</GTag2><h2 className="cm" style={{fontSize:"clamp(20px,4vw,38px)",fontWeight:400,color:T.text,margin:"13px 0 12px",lineHeight:1.3}}>Talento em excesso.<br/><span style={{fontStyle:"italic",color:T.gold}}>Controle em falta.</span></h2>
            <p style={{color:T.mutedLt,fontSize:13,lineHeight:1.8,maxWidth:600,margin:"0 auto"}}>Você domina técnicas, encanta clientes e constrói uma reputação impecável. Mas, entre planilhas soltas, agendas em papel e cálculos feitos de cabeça, a gestão consome um tempo que deveria estar dedicado ao que você faz de melhor.</p>
          </div>
          <div className="g2" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:13}}>
            {[
              ["Preços no feeling","Sem saber o custo real de cada procedimento, é impossível garantir que cada atendimento seja, de fato, lucrativo."],
              ["Agenda desorganizada","Horários confundidos, confirmações esquecidas e clientes que somem sem aviso — cada falha custa receita."],
              ["Decisões sem dados","Sem relatórios claros, cada escolha de negócio se torna uma aposta, não uma estratégia."],
            ].map(([t,d])=>(
              <div key={t} className="fc" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:13,padding:"20px 18px"}}>
                <h3 style={{color:T.text,fontSize:13,fontWeight:600,marginBottom:8}}>{t}</h3>
                <p style={{color:T.muted,fontSize:11,lineHeight:1.7}}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES (a solução) */}
      <section id="feats" style={{padding:"66px clamp(16px,6vw,52px)"}}>
        <div style={{maxWidth:1040,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:40}}><GTag2>A solução completa</GTag2><h2 className="cm" style={{fontSize:"clamp(20px,4vw,38px)",fontWeight:400,color:T.text,margin:"13px 0 8px",lineHeight:1.25}}>Tudo o que sua clínica precisa,<br/><span style={{fontStyle:"italic",color:T.gold}}>em um só lugar refinado.</span></h2></div>
          <div className="feat-grid" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
            {feats.map((f,i)=><div key={i} className="fc" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"18px 16px",boxShadow:"0 2px 10px #7C5CBF0A"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:9}}>
                <div style={{background:`${T.gold}13`,borderRadius:7,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><f.Icon c={T.gold} s={15}/></div>
                <h3 style={{color:T.text,fontSize:12,fontWeight:600,lineHeight:1.3}}>{f.t}</h3>
              </div>
              <p style={{color:T.muted,fontSize:11,lineHeight:1.7}}>{f.d}</p>
            </div>)}
          </div>
        </div>
      </section>

      {/* DEPOIMENTOS */}
      <section style={{padding:"60px clamp(16px,6vw,52px)",background:T.surface,borderTop:`1px solid ${T.border}`}}>
        <div style={{maxWidth:920,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:38}}><GTag2>Resultados que falam por si</GTag2><h2 className="cm" style={{fontSize:"clamp(18px,4vw,34px)",fontWeight:400,color:T.text,margin:"12px 0"}}>O que dizem as clínicas que já vivem essa transformação</h2></div>
          <div className="g1" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:13}}>
            {depos.map((d,i)=><div key={i} className="fc" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:13,padding:"18px 16px",boxShadow:"0 2px 10px #7C5CBF0A"}}>
              <div style={{display:"flex",gap:2,marginBottom:10}}>{Array(5).fill(0).map((_,j)=><I.Star key={j} c={T.gold} s={11}/>)}</div>
              <p style={{color:T.text,fontSize:11,lineHeight:1.75,fontStyle:"italic",marginBottom:13}}>"{d.txt}"</p>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:28,height:28,borderRadius:"50%",background:`${T.gold}20`,display:"flex",alignItems:"center",justifyContent:"center",color:T.gold,fontWeight:700,fontSize:11}}>{d.nome[0]}</div>
                <div><div style={{color:T.text,fontWeight:600,fontSize:11}}>{d.nome}</div><div style={{color:T.muted,fontSize:9}}>{d.clinica}</div></div>
              </div>
            </div>)}
          </div>
        </div>
      </section>

      {/* PLANOS (investimento) */}
      <section id="precos" style={{padding:"66px clamp(16px,6vw,52px)"}}>
        <div style={{maxWidth:720,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:40}}><GTag2>Investimento transparente</GTag2><h2 className="cm" style={{fontSize:"clamp(20px,4vw,38px)",fontWeight:400,color:T.text,margin:"13px 0 7px",lineHeight:1.25}}>Uma versão completa.<br/><span style={{fontStyle:"italic",color:T.gold}}>Sem letras miúdas.</span></h2></div>
          <div className="plan-grid cs" style={{display:"flex",gap:13,alignItems:"stretch"}}>
            <div className="ph ws" style={{flex:1,background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:"24px 20px",display:"flex",flexDirection:"column"}}>
              <div style={{color:T.mutedLt,fontSize:10,textTransform:"uppercase",letterSpacing:1.4,marginBottom:7}}>Plano Mensal</div>
              <div style={{display:"flex",alignItems:"flex-end",gap:5,marginBottom:18}}><span className="cm" style={{fontSize:44,fontWeight:600,color:T.text,lineHeight:1}}>399</span><span style={{color:T.muted,fontSize:12,marginBottom:5}}>R$/mês</span></div>
              <div style={{flex:1}}>{["Até 5 usuárias","14 módulos completos","Inteligência artificial","CRM e campanhas por WhatsApp","Suporte via WhatsApp"].map(f=><div key={f} style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}><I.Check c={T.success} s={11}/><span style={{color:T.text,fontSize:11}}>{f}</span></div>)}</div>
              <button className="ob" onClick={()=>onCheckout("mensal")} style={{width:"100%",background:"transparent",color:T.gold,border:`1px solid ${T.gold}50`,borderRadius:9,padding:"10px",fontWeight:600,fontSize:12,marginTop:18,cursor:"pointer"}}>Assinar mensalmente</button>
            </div>
            <div className="ph ws" style={{flex:1,background:`linear-gradient(145deg,#FFFFFF,#FBF6E8)`,border:`1.5px solid ${T.gold}50`,borderRadius:16,padding:"24px 20px",display:"flex",flexDirection:"column",position:"relative",boxShadow:"0 8px 28px #7C5CBF14"}}>
              <div style={{position:"absolute",top:12,right:12,background:T.gold,color:"#FFFFFF",borderRadius:20,padding:"3px 10px",fontSize:8,fontWeight:800,letterSpacing:1,textTransform:"uppercase"}}>Melhor valor</div>
              <div style={{color:T.gold,fontSize:10,textTransform:"uppercase",letterSpacing:1.4,marginBottom:7}}>Plano Anual</div>
              <div style={{display:"flex",alignItems:"flex-end",gap:5,marginBottom:4}}><span className="cm" style={{fontSize:44,fontWeight:600,color:T.goldLt,lineHeight:1}}>3.990</span><span style={{color:T.muted,fontSize:12,marginBottom:5}}>R$/ano</span></div>
              <div style={{color:T.success,fontSize:10,fontWeight:600,marginBottom:2}}>✓ Dois meses por nossa conta — R$ 798 de economia</div>
              <div style={{color:T.muted,fontSize:9,marginBottom:18}}>Equivalente a R$ 332,50 por mês</div>
              <div style={{flex:1}}>{["Até 5 usuárias","14 módulos completos","Inteligência artificial","CRM e campanhas por WhatsApp","Suporte prioritário","Relatórios exclusivos"].map(f=><div key={f} style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}><I.Check c={T.gold} s={11}/><span style={{color:T.text,fontSize:11}}>{f}</span></div>)}</div>
              <button className="gb gl" onClick={()=>onCheckout("anual")} style={{width:"100%",background:T.gold,color:"#FFFFFF",border:"none",borderRadius:9,padding:"11px",fontWeight:700,fontSize:13,marginTop:18,cursor:"pointer"}}>Assinar anualmente →</button>
            </div>
          </div>
        </div>
      </section>

      {/* PROGRAMA DE AFILIADOS */}
      <section id="afiliados" style={{padding:"66px clamp(16px,6vw,52px)",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:`radial-gradient(circle at 30% 20%,${T.gold}0C,transparent 60%)`,pointerEvents:"none"}}/>
        <div style={{maxWidth:820,margin:"0 auto",position:"relative"}}>
          <div style={{background:`linear-gradient(145deg,#FFFFFF,#FBF6E8)`,border:`1.5px solid ${T.gold}45`,borderRadius:20,padding:"clamp(28px,5vw,48px)",textAlign:"center",boxShadow:"0 12px 36px #7C5CBF14"}}>
            <GTag2><I.Star c={T.gold} s={10}/> Programa de Indicação</GTag2>
            <h2 className="cm" style={{fontSize:"clamp(24px,4.5vw,42px)",fontWeight:400,color:T.text,margin:"16px 0 10px",lineHeight:1.25}}>Seja uma <span style={{fontStyle:"italic",color:T.gold}}>Afiliada VPBeauty</span><br/>e ganhe 20% vitalícios de cada clínica que indicar</h2>
            <p style={{color:T.mutedLt,fontSize:13,lineHeight:1.8,maxWidth:520,margin:"0 auto 28px"}}>Você conhece o universo da estética como ninguém. Transforme essa rede de contatos em uma fonte de renda recorrente — enquanto sua indicação permanecer assinante, sua comissão continua chegando, mês após mês.</p>
            <div className="g2" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:30,textAlign:"left"}}>
              {[
                ["Comissão vitalícia","Enquanto o cliente indicado permanecer assinante, você continua recebendo."],
                ["Seu código exclusivo","Um link só seu para compartilhar e acompanhar cada indicação em tempo real."],
                ["Pagamento via Pix","Direto na sua chave cadastrada, de forma simples e segura."],
              ].map(([t,d])=>(
                <div key={t}>
                  <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:5}}><I.Check c={T.gold} s={13}/><span style={{color:T.text,fontSize:12,fontWeight:600}}>{t}</span></div>
                  <p style={{color:T.muted,fontSize:11,lineHeight:1.6,marginLeft:20}}>{d}</p>
                </div>
              ))}
            </div>
            <button className="gb gl" onClick={()=>setModalAfiliado(true)} style={{background:T.gold,color:"#FFFFFF",border:"none",borderRadius:10,padding:"13px 30px",fontWeight:700,fontSize:14,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:8}}>
              Quero ser Afiliada <I.Arrow c="#FFFFFF" s={14}/>
            </button>
            <p style={{color:T.muted,fontSize:10,marginTop:12}}>Cadastro gratuito e leva menos de 5 minutos</p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{padding:"60px clamp(16px,6vw,52px)",background:T.surface,borderTop:`1px solid ${T.border}`}}>
        <div style={{maxWidth:640,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:36}}><GTag2>Perguntas frequentes</GTag2><h2 className="cm" style={{fontSize:"clamp(18px,4vw,34px)",fontWeight:400,color:T.text,margin:"12px 0"}}>Tudo o que você precisa saber</h2></div>
          {faq.map((item,i)=>(
            <div key={i} style={{borderBottom:`1px solid ${T.border}`}}>
              <button onClick={()=>setActiveQ(activeQ===i?null:i)} style={{width:"100%",background:"none",border:"none",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 0",gap:12,textAlign:"left",cursor:"pointer"}}>
                <span style={{color:T.text,fontSize:12,fontWeight:500}}>{item.q}</span>
                <div style={{flexShrink:0,transform:activeQ===i?"rotate(45deg)":"rotate(0)"}}><I.X c={T.gold} s={15}/></div>
              </button>
              {activeQ===i&&<div className="fu" style={{paddingBottom:13}}><p style={{color:T.mutedLt,fontSize:11,lineHeight:1.75}}>{item.r}</p></div>}
            </div>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{padding:"66px clamp(16px,6vw,52px)",textAlign:"center"}}>
        <h2 className="cm" style={{fontSize:"clamp(24px,5vw,50px)",fontWeight:300,color:T.text,lineHeight:1.2,marginBottom:13}}>Comece hoje.<br/><span style={{fontStyle:"italic",fontWeight:600,color:T.gold}}>Sinta a diferença já na primeira semana.</span></h2>
        <div className="hero-btns" style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap",marginTop:24}}>
          <button className="gb gl" onClick={()=>onCheckout("anual")} style={{background:T.gold,color:"#FFFFFF",border:"none",borderRadius:10,padding:"12px 30px",fontWeight:700,fontSize:14,cursor:"pointer"}}>Assinar — R$ 3.990/ano</button>
          <button className="ob" onClick={onLogin} style={{background:"transparent",color:T.mutedLt,border:`1px solid ${T.border}`,borderRadius:10,padding:"12px 20px",fontWeight:500,fontSize:12,cursor:"pointer"}}>Já sou cliente</button>
        </div>
        <p style={{color:T.muted,fontSize:10,marginTop:12}}>Acesso imediato · Até 5 usuárias · Cancele quando desejar</p>
      </section>

      {modalAfiliado&&<CadastroAfiliadoModal onClose={()=>setModalAfiliado(false)} onSuccess={(dados)=>{setModalAfiliado(false);setAfiliadoSucesso(dados);}}/>}

      {afiliadoSucesso&&<div style={{position:"fixed",inset:0,background:"#4A3D6280",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(4px)"}} onClick={e=>e.target===e.currentTarget&&setAfiliadoSucesso(null)}>
        <div className="fu" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:32,maxWidth:420,textAlign:"center"}}>
          <div style={{width:56,height:56,borderRadius:"50%",background:T.success+"18",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}><I.Check c={T.success} s={26}/></div>
          <h3 className="cm" style={{fontSize:20,fontWeight:600,color:T.text,marginBottom:8}}>Bem-vinda ao Programa!</h3>
          <p style={{color:T.mutedLt,fontSize:12,lineHeight:1.7,marginBottom:16}}>Seu cadastro foi concluído e o contrato assinado. Este é o seu código de afiliada:</p>
          <div style={{background:T.gold+"14",border:`1.5px solid ${T.gold}45`,borderRadius:10,padding:"12px 16px",marginBottom:18}}>
            <span className="cm" style={{fontSize:22,fontWeight:700,color:T.gold,letterSpacing:1}}>{afiliadoSucesso.codigo}</span>
          </div>
          <p style={{color:T.muted,fontSize:11,marginBottom:20}}>Faça login com seu e-mail e senha para acessar sua área de afiliada, acompanhar indicações e solicitar saques.</p>
          <button className="gb" onClick={()=>{setAfiliadoSucesso(null);onLogin();}} style={{width:"100%",background:T.gold,color:"#FFFFFF",border:"none",borderRadius:9,padding:"12px",fontWeight:700,fontSize:13,cursor:"pointer"}}>Entrar na minha área →</button>
        </div>
      </div>}

      <footer style={{borderTop:`1px solid ${T.border}`,padding:"20px clamp(16px,5vw,52px)"}}>
        <div style={{maxWidth:1000,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
          <div className="cm" style={{fontSize:16,fontWeight:600,color:T.text}}>VP<span style={{color:T.gold}}>Beauty</span></div>
          <div style={{color:T.muted,fontSize:10}}>© 2026 VPBeauty · Um produto VirtualPlan · Todos os direitos reservados</div>
          <div style={{display:"flex",gap:14}}>{["Privacidade","Termos","Suporte"].map(l=><span key={l} style={{color:T.muted,fontSize:10,cursor:"pointer"}}>{l}</span>)}</div>
        </div>
      </footer>
    </div>
  );
}



/* ─── SISTEMA PRINCIPAL ──────────────────────────────────────── */
/* ─── BANNER DE RENOVAÇÃO DE ASSINATURA ─────────────────────────
   Aparece quando faltam ≤30 dias para o vencimento do contrato.
   Oferece renovação com 10% de desconto reaproveitando o checkout. */
function BannerRenovacao({user}) {
  const [checkoutRenovacao,setCheckoutRenovacao] = useState(null);
  const [dispensado,setDispensado] = useState(false);

  if (user.acessoVitalicio || !user.contratoVencimento || dispensado) return null;

  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const venc = new Date(user.contratoVencimento+"T00:00:00");
  const dias = Math.ceil((venc-hoje)/(1000*60*60*24));

  if (dias > 30) return null;

  const vencida = dias < 0;

  return (
    <>
      <div style={{background:vencida?C.danger+"12":C.warn+"12",border:`1px solid ${vencida?C.danger:C.warn}35`,borderRadius:10,padding:"10px 14px",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <I.Warn c={vencida?C.danger:C.warn} s={16}/>
          <div>
            <div style={{color:vencida?C.danger:C.warn,fontSize:12,fontWeight:700}}>
              {vencida ? `Sua assinatura venceu há ${Math.abs(dias)} dia(s)` : `Sua assinatura vence em ${dias} dia(s)`}
            </div>
            <div style={{color:C.muted,fontSize:11}}>Renove agora e ganhe <strong>10% de desconto</strong> na próxima cobrança.</div>
          </div>
        </div>
        <div style={{display:"flex",gap:7}}>
          <Btn onClick={()=>setCheckoutRenovacao("anual")}><I.Check s={12}/> Renovar com 10% off</Btn>
          <button onClick={()=>setDispensado(true)} style={{background:"none",border:"none",color:C.muted,fontSize:11,cursor:"pointer"}}>Depois</button>
        </div>
      </div>
      {checkoutRenovacao&&<CheckoutModal plan={checkoutRenovacao} desconto={10} onClose={()=>setCheckoutRenovacao(null)} onSuccess={()=>{setCheckoutRenovacao(null);setDispensado(true);}}/>}
    </>
  );
}

function Sistema({user, onLogout}) {
  const [pag, setPag] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const { data, loading, update, insert, remove } = useData(user.id);
  const isSupervisor = user.role !== "profissional";

  /* Verifica se o profissional logado tem permissão especial de cadastros (flag no seu próprio registro) */
  const meuProfissional = data?.profissionais?.find(p=>p.id===user.profissionalId);
  const podeGerenciarCadastros = isSupervisor || !!meuProfissional?.permite_cadastros;

  const menuCompleto = [
    {id:"dashboard",   label:"Dashboard",      Icon:I.Grid, todos:true},
    {id:"agendamentos",label:"Agendamentos",    Icon:I.Cal, todos:true},
    {id:"atendimentos",label:"Atendimentos",    Icon:I.Receipt, todos:true},
    {id:"pacientes",   label:"Pacientes",       Icon:I.User, todos:true},
    {id:"comissoes",   label:isSupervisor?"Comissões":"Minhas Comissões", Icon:I.Dollar, todos:true, alertFn:(d,u)=>{const c=(d.comissoes||[]).filter(x=>x.status==="pendente"&&(isSupervisor||x.profissional_id===u?.profissionalId));return c.length;}},
    {id:"fornecedores",label:"Fornecedores",    Icon:I.Truck, todos:podeGerenciarCadastros},
    {id:"produtos",    label:"Produtos",        Icon:I.Box, todos:podeGerenciarCadastros},
    {id:"procedimentos",label:"Procedimentos",  Icon:I.Scissors, todos:podeGerenciarCadastros},
    {id:"estoque",     label:"Estoque",         Icon:I.ShoppingCart, alertFn:d=>d.produtos.filter(p=>p.estoque_atual<=p.estoque_minimo).length},
    {id:"financeiro",  label:"Financeiro",      Icon:I.Dollar},
    {id:"precos",      label:"Custos & Preços", Icon:I.Calculator},
    {id:"relatorios",  label:"Relatórios & CRM",Icon:I.Bar},
    {id:"salas",       label:"Locação de Salas", Icon:I.Bank},
    {id:"cadastros",   label:"Cadastros",       Icon:I.Settings},
    {id:"ia",          label:"Assistente IA",   Icon:I.Sparkle, todos:true},
  ];
  /* Profissional só vê os itens marcados como "todos" — Supervisor vê tudo */
  const menu = isSupervisor ? menuCompleto : menuCompleto.filter(m=>m.todos);

  const bottomNavCompleto = [
    {id:"dashboard",   label:"Início",  Icon:I.Grid, todos:true},
    {id:"agendamentos",label:"Agenda",  Icon:I.Cal, todos:true},
    {id:"atendimentos",label:"Atend.",  Icon:I.Receipt, todos:true},
    {id:"financeiro",  label:"Financ.", Icon:I.Dollar},
    {id:"ia",          label:"IA",      Icon:I.Sparkle, todos:true},
  ];
  const bottomNav = isSupervisor ? bottomNavCompleto : bottomNavCompleto.filter(m=>m.todos).concat([{id:"pacientes",label:"Pacientes",Icon:I.User,todos:true}]);

  /* Se o usuário logado tenta acessar uma página fora do seu nível, redireciona */
  useEffect(()=>{
    if(!isSupervisor && !menu.find(m=>m.id===pag)) setPag("dashboard");
  },[pag, isSupervisor]); // eslint-disable-line

  if(loading||!data) return(
    <div style={{display:"flex",height:"100vh",background:C.bg,alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{textAlign:"center"}}><div className="sp" style={{width:40,height:40,border:`3px solid ${C.accent}25`,borderTop:`3px solid ${C.accent}`,borderRadius:"50%",margin:"0 auto 14px"}}/><div style={{color:C.muted,fontSize:13}}>{DEMO_MODE?"Carregando dados demo...":"Conectando ao Supabase..."}</div></div>
    </div>
  );

  /* Filtra dados do profissional: só enxerga a própria agenda, atendimentos, pacientes e a si mesmo */
  const dataFiltrada = isSupervisor ? data : (() => {
    const meusAgendamentos = data.agendamentos.filter(a=>a.profissional_id===user.profissionalId);
    const meusAtendimentos = data.atendimentos.filter(a=>a.profissional_id===user.profissionalId);
    /* Pacientes: apenas quem já teve agendamento ou atendimento com este profissional */
    const idsPacientes = new Set([
      ...meusAgendamentos.map(a=>a.paciente_id).filter(Boolean),
      ...meusAtendimentos.map(a=>a.paciente_id).filter(Boolean),
    ]);
    const meusPacientes = data.pacientes.filter(p=>idsPacientes.has(p.id));
    /* Profissionais: só ele mesmo aparece em seletores e listagens */
    const euMesmo = data.profissionais.filter(p=>p.id===user.profissionalId);
    return {
      ...data,
      agendamentos: meusAgendamentos,
      atendimentos: meusAtendimentos,
      pacientes: meusPacientes,
      profissionais: euMesmo,
      anamneses: data.anamneses.filter(a=>idsPacientes.has(a.paciente_id)),
    };
  })();

  const p = {data: dataFiltrada, insert, update, remove};
  const render = () => {
    switch(pag) {
      case "dashboard":    return <Dashboard data={dataFiltrada} user={user}/>;
      case "agendamentos": return <Agendamentos {...p}/>;
      case "atendimentos": return <Atendimentos {...p}/>;
      case "pacientes":    return <Pacientes {...p} dadosCompletos={data} user={user}/>;
      case "comissoes":    return <Comissoes data={dataFiltrada} update={update} user={user}/>;
      case "fornecedores": return <Fornecedores {...p}/>;
      case "produtos":     return <Produtos {...p}/>;
      case "procedimentos":return <Procedimentos {...p}/>;
      case "estoque":      return <Estoque {...p}/>;
      case "financeiro":   return <Financeiro {...p} user={user}/>;
      case "precos":       return <Precos data={data} update={update}/>;
      case "relatorios":   return <Relatorios data={data} insert={insert}/>;
      case "salas":        return <Salas {...p}/>;
      case "cadastros":    return <Cadastros {...p} user={user}/>;
      case "ia":           return <ChatIA data={dataFiltrada} user={user}/>;
      default:             return <Dashboard data={data}/>;
    }
  };

  return (
    <div style={{display:"flex",height:"100vh",background:C.bg,fontFamily:"'Inter',sans-serif",color:C.text,overflow:"hidden"}}>
      {/* Sidebar desktop */}
      <div className="sys-sidebar" style={{width:192,background:C.surface,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",padding:"14px 10px",flexShrink:0,overflowY:"auto"}}>
        <div style={{marginBottom:18}}>
          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:2}}>
            <LogoMark size={26}/>
            <span className="cm" style={{color:C.text,fontWeight:600,fontSize:13}}>VPBeauty</span>
          </div>
          <div style={{color:C.muted,fontSize:9,marginLeft:33}}>{user.clinica}</div>
          <div style={{marginLeft:33,marginTop:3,display:"flex",alignItems:"center",gap:5}}>
            <span style={{fontSize:8,fontWeight:700,padding:"1px 6px",borderRadius:10,background:isSupervisor?C.accentSoft:C.info+"18",color:isSupervisor?C.accent:C.info,textTransform:"uppercase",letterSpacing:.5}}>
              {isSupervisor?"Supervisor":"Profissional"}
            </span>
          </div>
          {DEMO_MODE&&<div style={{marginLeft:33,marginTop:2,color:C.warn,fontSize:9}}>● Modo Demo</div>}
        </div>
        <nav style={{flex:1}}>
          {menu.map(item=>{
            const alert=item.alertFn?item.alertFn(data,user):0;
            return(
              <button key={item.id} className="nb" onClick={()=>setPag(item.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:7,padding:"6px 8px",borderRadius:8,border:"none",marginBottom:1,background:pag===item.id?C.accentSoft:"transparent",color:pag===item.id?C.accent:C.muted,fontWeight:pag===item.id?700:400,fontSize:11,textAlign:"left"}}>
                <item.Icon c={pag===item.id?C.accent:C.muted} s={12}/>
                {item.label}
                {item.id==="ia"&&<span style={{marginLeft:"auto",background:C.accent,color:"#FFFFFF",fontSize:7,fontWeight:800,padding:"1px 5px",borderRadius:20}}>IA</span>}
                {alert>0&&<span style={{marginLeft:"auto",background:C.danger,color:"#fff",fontSize:7,fontWeight:800,padding:"1px 5px",borderRadius:20}}>{alert}</span>}
              </button>
            );
          })}
        </nav>
        <div style={{borderTop:`1px solid ${C.border}`,paddingTop:9,marginTop:5}}>
          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:7}}>
            <div style={{width:26,height:26,borderRadius:"50%",background:C.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",color:C.accent,fontWeight:700,fontSize:10}}>{user.clinica[0]}</div>
            <div><div style={{color:C.text,fontSize:10,fontWeight:600}}>{user.clinica}</div><div style={{color:C.muted,fontSize:8}}>Plano {user.plano}</div></div>
          </div>
          <button onClick={onLogout} style={{width:"100%",display:"flex",alignItems:"center",gap:6,padding:"6px 8px",borderRadius:8,border:"none",background:"transparent",color:C.muted,fontSize:10,cursor:"pointer"}}>
            <I.Out c={C.muted} s={11}/> Sair
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="sys-content" style={{flex:1,overflowY:"auto",padding:"clamp(11px,3vw,18px)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,paddingBottom:10,borderBottom:`1px solid ${C.border}`}}>
          <div>
            <span style={{color:C.accent,fontWeight:700,fontSize:13}}>VPBeauty</span>
            <span style={{color:C.muted,fontSize:10,marginLeft:5}}>· {user.clinica}</span>
            {DEMO_MODE&&<span style={{color:C.warn,fontSize:9,marginLeft:8,background:C.warn+"14",padding:"1px 7px",borderRadius:20}}>Demo</span>}
          </div>
          <div className="sys-topbar-menu" style={{position:"relative"}}>
            <button onClick={()=>setMenuOpen(!menuOpen)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"5px 10px",color:C.muted,display:"flex",alignItems:"center",gap:5,fontSize:11,cursor:"pointer"}}>
              <I.Menu s={12}/> Módulos
            </button>
            {menuOpen&&(
              <div style={{position:"absolute",top:"calc(100% + 5px)",right:0,background:C.card,border:`1px solid ${C.border}`,borderRadius:11,padding:7,minWidth:185,zIndex:600,boxShadow:"0 8px 24px #00000055"}}>
                {menu.map(item=>(
                  <button key={item.id} onClick={()=>{setPag(item.id);setMenuOpen(false);}} style={{width:"100%",display:"flex",alignItems:"center",gap:7,padding:"7px 9px",borderRadius:7,border:"none",background:pag===item.id?C.accentSoft:"transparent",color:pag===item.id?C.accent:C.muted,fontSize:12,textAlign:"left",cursor:"pointer"}}>
                    <item.Icon c={pag===item.id?C.accent:C.muted} s={12}/>{item.label}
                  </button>
                ))}
                <div style={{borderTop:`1px solid ${C.border}`,marginTop:5,paddingTop:5}}>
                  <button onClick={onLogout} style={{width:"100%",display:"flex",alignItems:"center",gap:7,padding:"7px 9px",borderRadius:7,border:"none",background:"transparent",color:C.danger,fontSize:12,cursor:"pointer"}}><I.Out c={C.danger} s={12}/> Sair</button>
                </div>
              </div>
            )}
          </div>
        </div>
        {isSupervisor && <BannerRenovacao user={user}/>}
        {render()}
      </div>

      {/* Bottom Nav Mobile */}
      <nav className="bottom-nav">
        {bottomNav.map(item=>(
          <button key={item.id} className={`bn-item${pag===item.id?" active":""}`} onClick={()=>setPag(item.id)}>
            <item.Icon c={pag===item.id?C.accent:C.muted} s={20}/>
            <span>{item.label}</span>
          </button>
        ))}
        <button className={`bn-item${!bottomNav.find(b=>b.id===pag)?" active":""}`} onClick={()=>setMenuOpen(!menuOpen)}>
          <I.Menu c={!bottomNav.find(b=>b.id===pag)?C.accent:C.muted} s={20}/>
          <span>Mais</span>
        </button>
        {menuOpen&&(
          <div onClick={()=>setMenuOpen(false)} style={{position:"fixed",inset:0,background:"#4A3D6260",zIndex:850}}>
            <div onClick={e=>e.stopPropagation()} style={{position:"absolute",bottom:70,left:0,right:0,background:C.surface,borderTop:`1px solid ${C.border}`,borderRadius:"16px 16px 0 0",padding:"16px 16px 8px",maxHeight:"70vh",overflowY:"auto"}}>
              <div style={{width:32,height:3,background:C.border,borderRadius:2,margin:"0 auto 14px"}}/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                {menu.filter(m=>!bottomNav.find(b=>b.id===m.id)).map(item=>(
                  <button key={item.id} onClick={()=>{setPag(item.id);setMenuOpen(false);}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,padding:"12px 8px",borderRadius:10,border:`1px solid ${pag===item.id?C.accent:C.border}`,background:pag===item.id?C.accentSoft:"transparent",color:pag===item.id?C.accent:C.muted,fontSize:10,cursor:"pointer"}}>
                    <item.Icon c={pag===item.id?C.accent:C.muted} s={22}/>{item.label}
                  </button>
                ))}
                <button onClick={()=>{onLogout();setMenuOpen(false);}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,padding:"12px 8px",borderRadius:10,border:`1px solid ${C.border}`,background:"transparent",color:C.danger,fontSize:10,cursor:"pointer"}}>
                  <I.Out c={C.danger} s={22}/>Sair
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>
    </div>
  );
}

/* ─── APP ROOT ───────────────────────────────────────────────── */
/* ─── PAINEL DO DONO DO SISTEMA (super admin) ───────────────────
   Acesso restrito — só usuários cadastrados na tabela super_admins.
   Gerencia todas as clínicas assinantes do VPBeauty.               */
/* ─── PAINEL DO DONO DO SISTEMA (super admin) ───────────────────
   Acesso restrito — só usuários cadastrados na tabela super_admins.
   Gerencia todas as clínicas assinantes do VPBeauty.               */
function PainelAdmin({user, onLogout}) {
  const [clinicas,setClinicas] = useState([]);
  const [pagamentos,setPagamentos] = useState([]);
  const [config,setConfig] = useState({asaas_api_key:"", asaas_ambiente:"sandbox"});
  const [loading,setLoading] = useState(true);
  const [busca,setBusca] = useState("");
  const [filtroStatus,setFiltroStatus] = useState("");
  const [drillDown,setDrillDown] = useState(null); // qual KPI está aberto em detalhe
  const [bloqueioModal,setBloqueioModal] = useState(null);
  const [motivoBloqueio,setMotivoBloqueio] = useState("");
  const [abaAtiva,setAbaAtiva] = useState("principal"); // 'principal' | 'asaas' | 'afiliados'
  const [afiliados,setAfiliados] = useState([]);
  const [indicacoesAfiliados,setIndicacoesAfiliados] = useState([]);
  const [configAfiliados,setConfigAfiliados] = useState({afiliado_percentual_padrao:20, afiliado_valor_minimo_saque:200, afiliado_meses_inatividade:6});
  const [saquesAfiliados,setSaquesAfiliados] = useState([]);
  const [msgAfiliados,setMsgAfiliados] = useState("");
  const [pagModal,setPagModal] = useState(null);
  const [formPag,setFormPag] = useState({clinica_id:"",referencia:"",valor:0,vencimento:today()});
  const [msgConfig,setMsgConfig] = useState("");

  const carregar = async () => {
    setLoading(true);
    if(DEMO_MODE){
      const hoje = new Date();
      const em15dias = new Date(hoje); em15dias.setDate(em15dias.getDate()+15);
      const vencida = new Date(hoje); vencida.setDate(vencida.getDate()-5);
      const emUmAno = new Date(hoje); emUmAno.setDate(emUmAno.getDate()+300);
      setClinicas([
        {id:"demo-c1",nome:"Studio Demo",email:"demo@clinica.com",plano:"anual",contrato_vencimento:emUmAno.toISOString().split("T")[0],acesso_vitalicio:false,bloqueada:false,created_at:"2025-01-15"},
        {id:"demo-c2",nome:"Clínica Lumière",email:"admin@estetica.com",plano:"mensal",contrato_vencimento:em15dias.toISOString().split("T")[0],acesso_vitalicio:false,bloqueada:false,created_at:"2025-03-02"},
        {id:"demo-c3",nome:"Espaço Bella Pelle",email:"contato@bellapelle.com",plano:"anual",contrato_vencimento:vencida.toISOString().split("T")[0],acesso_vitalicio:false,bloqueada:true,motivo_bloqueio:"Inadimplência — 2 faturas em atraso",created_at:"2024-11-20"},
        {id:"demo-c4",nome:"Studio Camila Rocha",email:"camila.parceira@clinica.com",plano:"anual",contrato_vencimento:emUmAno.toISOString().split("T")[0],acesso_vitalicio:true,bloqueada:false,created_at:"2024-06-01"},
      ]);
      setPagamentos([
        {id:1,clinica_id:"demo-c1",referencia:"Maio/2025",valor:332.5,vencimento:"2025-05-05",data_pagamento:"2025-05-04",status:"pago",origem:"manual",conciliado:true},
        {id:2,clinica_id:"demo-c2",referencia:"Maio/2025",valor:399,vencimento:"2025-05-10",status:"aberto",origem:"manual",conciliado:false},
        {id:3,clinica_id:"demo-c3",referencia:"Abril/2025",valor:332.5,vencimento:"2025-04-05",status:"atrasado",origem:"manual",conciliado:false},
      ]);
      setConfig({asaas_api_key:"", asaas_ambiente:"sandbox"});
      setAfiliados([
        {id:"demo-af1",nome_completo:"Juliana Prado",cpf:"111.222.333-44",email:"juliana@email.com",codigo_afiliado:"JULIANA4821",status:"ativo",ultima_indicacao_em:"2026-06-01",created_at:"2026-01-10"},
      ]);
      setIndicacoesAfiliados([
        {id:1,afiliado_id:"demo-af1",clinica_nome:"Studio Bella Vitta",valor_assinatura:399,comissao_valor:79.8,status:"pendente",referencia:"Junho/2026",created_at:"2026-06-05"},
        {id:2,afiliado_id:"demo-af1",clinica_nome:"Espaço Renovare",valor_assinatura:3990,comissao_valor:798,status:"paga",referencia:"Maio/2026",created_at:"2026-05-12"},
      ]);
      setSaquesAfiliados([
        {id:1,afiliado_id:"demo-af1",valor:250,status:"solicitado",data_solicitacao:"2026-06-10"},
      ]);
      setConfigAfiliados({afiliado_percentual_padrao:20, afiliado_valor_minimo_saque:200, afiliado_meses_inatividade:6});
      setLoading(false);
      return;
    }
    try {
      const [c, p, cfg, afs, saqs, inds] = await Promise.all([
        sb.get("clinicas","order=created_at.desc"),
        sb.get("pagamentos_assinatura","order=vencimento.desc"),
        sb.get("config_sistema",""),
        sb.get("afiliados","order=created_at.desc"),
        sb.get("afiliado_saques","order=data_solicitacao.desc"),
        sb.get("afiliado_indicacoes","order=created_at.desc"),
      ]);
      setClinicas(c||[]);
      setPagamentos(p||[]);
      if(cfg?.[0]){ setConfig(cfg[0]); setConfigAfiliados(cfg[0]); }
      setAfiliados(afs||[]);
      setSaquesAfiliados(saqs||[]);
      setIndicacoesAfiliados(inds||[]);
    } catch(e){ console.error(e); }
    setLoading(false);
  };

  useEffect(()=>{ carregar(); },[]); // eslint-disable-line

  const diasParaVencer = (dataVenc) => {
    if(!dataVenc) return null;
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const venc = new Date(dataVenc+"T00:00:00");
    return Math.ceil((venc-hoje)/(1000*60*60*24));
  };

  const statusDe = (c) => {
    if(c.bloqueada) return "bloqueada";
    if(c.acesso_vitalicio) return "vitalicio";
    const dias = diasParaVencer(c.contrato_vencimento);
    if(dias===null) return "ativa";
    if(dias<0) return "vencida";
    if(dias<=30) return "vencendo";
    return "ativa";
  };

  const statusInfo = {
    ativa:{label:"Ativa",cor:C.success},
    vencendo:{label:"Vencendo",cor:C.warn},
    vencida:{label:"Vencida",cor:C.danger},
    vitalicio:{label:"Vitalício",cor:C.purple},
    bloqueada:{label:"Bloqueada",cor:C.danger},
  };

  const lista = useMemo(()=>{
    let l = [...clinicas];
    if(busca){ const b=busca.toLowerCase(); l=l.filter(c=>c.nome?.toLowerCase().includes(b)||c.email?.toLowerCase().includes(b)); }
    if(filtroStatus) l=l.filter(c=>statusDe(c)===filtroStatus);
    return l;
  },[clinicas,busca,filtroStatus]);

  const ativas = clinicas.filter(c=>statusDe(c)==="ativa");
  const vencendo = clinicas.filter(c=>statusDe(c)==="vencendo");
  const vencidas = clinicas.filter(c=>statusDe(c)==="vencida");
  const vitalicias = clinicas.filter(c=>c.acesso_vitalicio);
  const bloqueadas = clinicas.filter(c=>c.bloqueada);

  const precoMensal = {mensal:399, anual:3990/12};
  const mrr = clinicas.filter(c=>!c.acesso_vitalicio && !c.bloqueada).reduce((s,c)=>s+(precoMensal[c.plano]||0),0);

  const evolucaoMensal = useMemo(()=>{
    const porMes = {};
    clinicas.forEach(c=>{
      if(!c.created_at) return;
      const mes = c.created_at.slice(0,7);
      porMes[mes] = (porMes[mes]||0)+1;
    });
    return Object.entries(porMes).sort((a,b)=>a[0].localeCompare(b[0])).slice(-8);
  },[clinicas]);
  const maiorEvolucao = Math.max(1,...evolucaoMensal.map(([,v])=>v));

  const concederVitalicio = async (clinica) => {
    if(!window.confirm(`Conceder acesso vitalício gratuito para "${clinica.nome}"?`)) return;
    if(DEMO_MODE){ setClinicas(cs=>cs.map(c=>c.id===clinica.id?{...c,acesso_vitalicio:true}:c)); return; }
    await sb.patch("clinicas", clinica.id, {acesso_vitalicio:true, status_assinatura:"vitalicia"});
    carregar();
  };

  const removerVitalicio = async (clinica) => {
    if(!window.confirm(`Remover acesso vitalício de "${clinica.nome}"?`)) return;
    if(DEMO_MODE){ setClinicas(cs=>cs.map(c=>c.id===clinica.id?{...c,acesso_vitalicio:false}:c)); return; }
    await sb.patch("clinicas", clinica.id, {acesso_vitalicio:false, status_assinatura:"ativa"});
    carregar();
  };

  const abrirBloqueio = (clinica) => { setBloqueioModal(clinica); setMotivoBloqueio(""); };
  const confirmarBloqueio = async () => {
    if(!bloqueioModal) return;
    if(DEMO_MODE){ setClinicas(cs=>cs.map(c=>c.id===bloqueioModal.id?{...c,bloqueada:true,motivo_bloqueio:motivoBloqueio}:c)); setBloqueioModal(null); return; }
    await sb.patch("clinicas", bloqueioModal.id, {bloqueada:true, motivo_bloqueio:motivoBloqueio, bloqueada_em:new Date().toISOString()});
    setBloqueioModal(null);
    carregar();
  };
  const desbloquear = async (clinica) => {
    if(!window.confirm(`Desbloquear "${clinica.nome}"? O acesso ao sistema volta imediatamente.`)) return;
    if(DEMO_MODE){ setClinicas(cs=>cs.map(c=>c.id===clinica.id?{...c,bloqueada:false,motivo_bloqueio:null}:c)); return; }
    await sb.patch("clinicas", clinica.id, {bloqueada:false, motivo_bloqueio:null});
    carregar();
  };

  /* ── Gestão do Programa de Afiliados ── */
  const salvarConfigAfiliados = async () => {
    setMsgAfiliados("");
    if(DEMO_MODE){ setMsgAfiliados("✓ Configuração salva (modo demo)."); return; }
    try {
      await sb.patch("config_sistema", "true", {
        afiliado_percentual_padrao: Number(configAfiliados.afiliado_percentual_padrao),
        afiliado_valor_minimo_saque: Number(configAfiliados.afiliado_valor_minimo_saque),
        afiliado_meses_inatividade: Number(configAfiliados.afiliado_meses_inatividade),
      });
      setMsgAfiliados("✓ Regras do programa atualizadas!");
    } catch(e){ setMsgAfiliados("Erro ao salvar."); }
  };

  const descredenciarAfiliado = async (afiliado) => {
    const motivo = window.prompt(`Motivo do descredenciamento de ${afiliado.nome_completo}:`, "Sem novas indicações no período mínimo");
    if(motivo===null) return;
    if(DEMO_MODE){ setAfiliados(a=>a.map(x=>x.id===afiliado.id?{...x,status:"descredenciado",motivo_descredenciamento:motivo}:x)); return; }
    await sb.patch("afiliados", afiliado.id, {status:"descredenciado", motivo_descredenciamento:motivo});
    carregar();
  };
  const reativarAfiliado = async (afiliado) => {
    if(DEMO_MODE){ setAfiliados(a=>a.map(x=>x.id===afiliado.id?{...x,status:"ativo",motivo_descredenciamento:null}:x)); return; }
    await sb.patch("afiliados", afiliado.id, {status:"ativo", motivo_descredenciamento:null});
    carregar();
  };
  const marcarSaquePago = async (saque) => {
    if(DEMO_MODE){ setSaquesAfiliados(s=>s.map(x=>x.id===saque.id?{...x,status:"pago",data_pagamento:today()}:x)); return; }
    await sb.patch("afiliado_saques", saque.id, {status:"pago", data_pagamento:new Date().toISOString()});
    carregar();
  };
  const marcarComissaoPaga = async (indicacao) => {
    if(DEMO_MODE){ setIndicacoesAfiliados(l=>l.map(x=>x.id===indicacao.id?{...x,status:"paga"}:x)); return; }
    await sb.patch("afiliado_indicacoes", indicacao.id, {status:"paga"});
    carregar();
  };

  const salvarConfigAsaas = async () => {
    setMsgConfig("");
    if(DEMO_MODE){ setMsgConfig("✓ Configuração salva (modo demo)."); return; }
    try {
      await sb.patch("config_sistema", "true", config);
      setMsgConfig("✓ Chave salva. A sincronização automática ainda depende da Edge Function (veja nota abaixo).");
    } catch(e){ setMsgConfig("Erro ao salvar."); }
  };

  /* ── Lembretes semanais de renovação (e-mail via Resend) ──
     Verifica clínicas com ≤30 dias para vencer e envia e-mail
     se já se passou 1 semana desde o último aviso. Disparo manual
     por enquanto — a versão automática usa a mesma Edge Function
     pattern do Asaas, rodando 1x por dia via Cron.                */
  const [enviandoRenovacao,setEnviandoRenovacao] = useState(false);
  const [msgRenovacao,setMsgRenovacao] = useState("");

  const verificarEEnviarRenovacoes = async () => {
    setEnviandoRenovacao(true);
    let enviados = 0, pulados = 0;
    const candidatas = clinicas.filter(c=>{
      if(c.acesso_vitalicio || c.bloqueada) return false;
      const dias = diasParaVencer(c.contrato_vencimento);
      if(dias===null || dias>30 || dias<-60) return false; // ignora vencidas há muito tempo (provável cancelamento)
      if(!c.ultima_notificacao_renovacao) return true;
      const diasDesdeUltima = Math.floor((new Date()-new Date(c.ultima_notificacao_renovacao+"T00:00:00"))/(1000*60*60*24));
      return diasDesdeUltima>=7;
    });

    if(!config.resend_api_key){
      setEnviandoRenovacao(false);
      setMsgRenovacao(`⚠ Resend não configurado. ${candidatas.length} clínica(s) elegível(is) para lembrete — configure a chave abaixo para enviar.`);
      return;
    }

    for(const c of candidatas){
      const dias = diasParaVencer(c.contrato_vencimento);
      const assunto = dias<0 ? `Sua assinatura VPBeauty venceu — renove com 10% off` : `Sua assinatura VPBeauty vence em ${dias} dia(s)`;
      const corpo = `<p>Olá, ${c.responsavel||c.nome}!</p><p>${dias<0?`Sua assinatura do VPBeauty venceu há ${Math.abs(dias)} dia(s).`:`Sua assinatura do VPBeauty vence em ${dias} dia(s).`}</p><p>Renove agora e garanta <strong>10% de desconto</strong> na próxima cobrança. Acesse o sistema e clique no banner de renovação, ou responda este e-mail para combinarmos.</p><p>Equipe VPBeauty</p>`;
      try {
        await fetch("https://api.resend.com/emails",{
          method:"POST",
          headers:{"Content-Type":"application/json","Authorization":`Bearer ${config.resend_api_key}`},
          body:JSON.stringify({from:config.resend_email_remetente||"financeiro@virtualplan.com.br", to:c.email, subject:assunto, html:corpo}),
        });
        await sb.patch("clinicas", c.id, {ultima_notificacao_renovacao:today()});
        enviados++;
      } catch(e){ pulados++; }
    }
    setEnviandoRenovacao(false);
    setMsgRenovacao(`✓ ${enviados} e-mail(s) de renovação enviado(s). ${pulados>0?`${pulados} erro(s).`:""}`);
    carregar();
  };

  const registrarPagamento = async () => {
    if(!formPag.clinica_id||!formPag.valor) return;
    await sb.post("pagamentos_assinatura", {...formPag, valor:Number(formPag.valor), status:"aberto", origem:"manual"});
    setPagModal(null);
    setFormPag({clinica_id:"",referencia:"",valor:0,vencimento:today()});
    carregar();
  };

  const marcarPago = async (pag) => {
    await sb.patch("pagamentos_assinatura", pag.id, {status:"pago", data_pagamento:today()});
    carregar();
  };
  const marcarConciliado = async (pag) => {
    await sb.patch("pagamentos_assinatura", pag.id, {conciliado:!pag.conciliado});
    carregar();
  };

  const totalRecebidoSistema = pagamentos.filter(p=>p.status==="pago").reduce((s,p)=>s+(Number(p.valor)||0),0);
  const totalConciliado = pagamentos.filter(p=>p.status==="pago"&&p.conciliado).reduce((s,p)=>s+(Number(p.valor)||0),0);
  const totalNaoConciliado = totalRecebidoSistema - totalConciliado;

  if(loading) return (
    <div style={{display:"flex",height:"100vh",background:C.bg,alignItems:"center",justifyContent:"center",fontFamily:"'Inter',sans-serif"}}>
      <div style={{textAlign:"center"}}><div className="sp" style={{width:40,height:40,border:`3px solid ${C.accent}25`,borderTop:`3px solid ${C.accent}`,borderRadius:"50%",margin:"0 auto 14px"}}/><div style={{color:C.muted,fontSize:13}}>Carregando painel administrativo...</div></div>
    </div>
  );

  const kpis = [
    {id:"ativas",label:"Clínicas Ativas",value:ativas.length,Icon:I.Check,color:C.success,lista:ativas},
    {id:"vencendo",label:"Vencendo em 30 dias",value:vencendo.length,Icon:I.Warn,color:C.warn,lista:vencendo},
    {id:"vencidas",label:"Vencidas",value:vencidas.length,Icon:I.X,color:C.danger,lista:vencidas},
    {id:"bloqueadas",label:"Bloqueadas",value:bloqueadas.length,Icon:I.Lock,color:C.danger,lista:bloqueadas},
    {id:"vitalicias",label:"Acesso Vitalício",value:vitalicias.length,Icon:I.Star,color:C.purple,lista:vitalicias},
  ];

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Inter',sans-serif",padding:"0"}}>
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"14px clamp(16px,4vw,32px)",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <LogoMark size={30}/>
          <div>
            <div style={{color:C.text,fontWeight:700,fontSize:14}}>Painel Administrativo</div>
            <div style={{color:C.muted,fontSize:10}}>VPBeauty · {user.nome}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setAbaAtiva("principal")} style={{background:abaAtiva==="principal"?C.accentSoft:C.card,border:`1px solid ${abaAtiva==="principal"?C.accent:C.border}`,borderRadius:8,padding:"7px 14px",color:abaAtiva==="principal"?C.accent:C.muted,fontSize:12,cursor:"pointer"}}>
            Clientes
          </button>
          <button onClick={()=>setAbaAtiva("afiliados")} style={{background:abaAtiva==="afiliados"?C.accentSoft:C.card,border:`1px solid ${abaAtiva==="afiliados"?C.accent:C.border}`,borderRadius:8,padding:"7px 14px",color:abaAtiva==="afiliados"?C.accent:C.muted,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
            <I.Star s={13}/> Afiliados
          </button>
          <button onClick={()=>setAbaAtiva("asaas")} style={{background:abaAtiva==="asaas"?C.accentSoft:C.card,border:`1px solid ${abaAtiva==="asaas"?C.accent:C.border}`,borderRadius:8,padding:"7px 14px",color:abaAtiva==="asaas"?C.accent:C.muted,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
            <I.Bank s={13}/> Conciliação Asaas
          </button>
          <button onClick={onLogout} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 14px",color:C.muted,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
            <I.Out c={C.muted} s={13}/> Sair
          </button>
        </div>
      </div>

      <div style={{padding:"clamp(16px,3vw,28px)",maxWidth:1200,margin:"0 auto"}}>

        {abaAtiva==="principal" ? <>
          {/* KPIs clicáveis */}
          <div className="stat-row" style={{display:"flex",gap:11,marginBottom:20,flexWrap:"wrap"}}>
            {kpis.map(k=>(
              <button key={k.id} onClick={()=>setDrillDown(k)} style={{all:"unset",cursor:"pointer",flex:1,minWidth:120}}>
                <div className="fc" style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:13,padding:"14px 16px",boxShadow:"0 1px 8px #7C5CBF0A"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div>
                      <div style={{color:C.muted,fontSize:10,textTransform:"uppercase",letterSpacing:.8,marginBottom:5}}>{k.label}</div>
                      <div style={{color:C.text,fontSize:17,fontWeight:700}}>{k.value}</div>
                      <div style={{color:C.accent,fontSize:10,marginTop:3}}>Ver detalhes →</div>
                    </div>
                    <div style={{background:k.color+"18",borderRadius:9,padding:7}}><k.Icon c={k.color} s={14}/></div>
                  </div>
                </div>
              </button>
            ))}
            <SC label="MRR Estimado" value={fmt(mrr)} Icon={I.Dollar} color={C.accent} sub="Receita mensal recorrente"/>
          </div>

          {/* Lembretes de Renovação */}
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:13,padding:18,marginBottom:20}}>
            <h3 style={{color:C.text,fontSize:14,fontWeight:700,marginBottom:4,display:"flex",alignItems:"center",gap:7}}><I.Email c={C.accent} s={15}/> Lembretes de Renovação (e-mail)</h3>
            <p style={{color:C.muted,fontSize:11,marginBottom:12}}>Clínicas a 30 dias do vencimento recebem e-mail semanal com o link de renovação e 10% de desconto, até renovarem.</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
              <Inp label="Resend API Key" type="password" value={config.resend_api_key||""} onChange={e=>setConfig(c=>({...c,resend_api_key:e.target.value}))} placeholder="re_..."/>
              <Inp label="E-mail remetente" value={config.resend_email_remetente||""} onChange={e=>setConfig(c=>({...c,resend_email_remetente:e.target.value}))} placeholder="financeiro@virtualplan.com.br"/>
            </div>
            {msgRenovacao&&<div style={{background:msgRenovacao.startsWith("✓")?C.success+"14":C.warn+"14",border:`1px solid ${msgRenovacao.startsWith("✓")?C.success:C.warn}30`,borderRadius:8,padding:"8px 12px",marginBottom:10,color:msgRenovacao.startsWith("✓")?C.success:C.warn,fontSize:12}}>{msgRenovacao}</div>}
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <Btn onClick={salvarConfigAsaas}><I.Check s={12}/> Salvar Chave</Btn>
              <Btn v="i" onClick={verificarEEnviarRenovacoes} disabled={enviandoRenovacao}>
                {enviandoRenovacao?<><Spin s={12} c={C.info}/>Enviando...</>:<><I.Send s={12}/> Verificar e Enviar Lembretes</>}
              </Btn>
            </div>
          </div>

          {/* Evolução */}
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:13,padding:18,marginBottom:20}}>
            <h3 style={{color:C.text,fontSize:14,fontWeight:700,marginBottom:14}}>Evolução de Novas Assinaturas</h3>
            {evolucaoMensal.length===0
              ? <p style={{color:C.muted,fontSize:12}}>Sem dados suficientes ainda.</p>
              : <div style={{display:"flex",alignItems:"flex-end",gap:10,height:120}}>
                  {evolucaoMensal.map(([mes,qtd])=>(
                    <div key={mes} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
                      <div style={{color:C.accent,fontWeight:700,fontSize:12}}>{qtd}</div>
                      <div style={{width:"100%",height:Math.max(6,(qtd/maiorEvolucao)*80),background:`linear-gradient(180deg,${C.accent},${C.accent}88)`,borderRadius:6}}/>
                      <div style={{color:C.muted,fontSize:9}}>{new Date(mes+"-01").toLocaleDateString("pt-BR",{month:"short",year:"2-digit"})}</div>
                    </div>
                  ))}
                </div>
            }
          </div>

          {/* Lista de clínicas */}
          <h3 style={{color:C.text,fontSize:14,fontWeight:700,marginBottom:11}}>Clientes Assinantes</h3>
          <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
            <input type="text" value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar por nome ou e-mail..."
              style={{flex:1,minWidth:220,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.text,fontSize:13}}/>
            <select value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)}
              style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.text,fontSize:13}}>
              <option value="">Todos os status</option>
              <option value="ativa">Ativas</option>
              <option value="vencendo">Vencendo</option>
              <option value="vencida">Vencidas</option>
              <option value="bloqueada">Bloqueadas</option>
              <option value="vitalicio">Vitalícias</option>
            </select>
          </div>

          <ST cols={["Clínica","E-mail","Plano","Vencimento","Status","Ações"]}
            rows={lista.map(c=>{
              const st = statusDe(c);
              const dias = diasParaVencer(c.contrato_vencimento);
              return [
                <span style={{fontWeight:600}}>{c.nome}</span>,
                <span style={{color:C.muted,fontSize:11}}>{c.email}</span>,
                <Badge text={c.plano==="anual"?"Anual":"Mensal"} color={C.info}/>,
                <span style={{fontSize:11}}>
                  {c.acesso_vitalicio?"—":fmtDate(c.contrato_vencimento)}
                  {!c.acesso_vitalicio && dias!==null && dias>=0 && dias<=30 && <span style={{color:C.warn,marginLeft:5}}>({dias}d)</span>}
                  {!c.acesso_vitalicio && dias!==null && dias<0 && <span style={{color:C.danger,marginLeft:5}}>({Math.abs(dias)}d atrás)</span>}
                </span>,
                <div>
                  <Badge text={statusInfo[st].label} color={statusInfo[st].cor}/>
                  {c.bloqueada && c.motivo_bloqueio && <div style={{color:C.muted,fontSize:9,marginTop:3}}>{c.motivo_bloqueio}</div>}
                </div>,
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  {c.bloqueada
                    ? <Btn v="ok" onClick={()=>desbloquear(c)} style={{fontSize:10,padding:"3px 9px"}}><I.Check s={11}/> Desbloquear</Btn>
                    : <Btn v="d" onClick={()=>abrirBloqueio(c)} style={{fontSize:10,padding:"3px 9px"}}><I.Lock s={11}/> Bloquear</Btn>
                  }
                  {c.acesso_vitalicio
                    ? <Btn v="g" onClick={()=>removerVitalicio(c)} style={{fontSize:10,padding:"3px 9px"}}>Remover vitalício</Btn>
                    : <Btn v="i" onClick={()=>concederVitalicio(c)} style={{fontSize:10,padding:"3px 9px"}}><I.Star s={11}/> Vitalício</Btn>
                  }
                </div>,
              ];
            })}
            empty="Nenhuma clínica encontrada."
          />
        </> : null}

        {abaAtiva==="afiliados" && <>
          {/* ── ABA AFILIADOS ── */}
          <div className="stat-row" style={{display:"flex",gap:11,marginBottom:18,flexWrap:"wrap"}}>
            <SC label="Afiliados Ativos" value={afiliados.filter(a=>a.status==="ativo").length} Icon={I.Star} color={C.gold}/>
            <SC label="Clientes Indicados" value={indicacoesAfiliados.length} Icon={I.User} color={C.info}/>
            <SC label="Comissões Pendentes" value={fmt(indicacoesAfiliados.filter(i=>i.status==="pendente").reduce((s,i)=>s+(Number(i.comissao_valor)||0),0))} Icon={I.Warn} color={C.warn}/>
            <SC label="Saques Aguardando Pix" value={saquesAfiliados.filter(s=>s.status==="solicitado").length} Icon={I.Dollar} color={C.danger}/>
          </div>

          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:13,padding:18,marginBottom:18}}>
            <h3 style={{color:C.text,fontSize:14,fontWeight:700,marginBottom:4,display:"flex",alignItems:"center",gap:7}}><I.Star c={C.gold} s={16}/> Regras do Programa de Afiliados</h3>
            <p style={{color:C.muted,fontSize:11,marginBottom:12}}>Estas regras se aplicam a todos os afiliados. Alterações valem a partir de agora — indicações já registradas mantêm o percentual da época.</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:10}}>
              <Inp label="Percentual de comissão (%)" type="number" value={configAfiliados.afiliado_percentual_padrao} onChange={e=>setConfigAfiliados(c=>({...c,afiliado_percentual_padrao:e.target.value}))}/>
              <Inp label="Valor mínimo para saque (R$)" type="number" value={configAfiliados.afiliado_valor_minimo_saque} onChange={e=>setConfigAfiliados(c=>({...c,afiliado_valor_minimo_saque:e.target.value}))}/>
              <Inp label="Meses sem indicação p/ descredenciar" type="number" value={configAfiliados.afiliado_meses_inatividade} onChange={e=>setConfigAfiliados(c=>({...c,afiliado_meses_inatividade:e.target.value}))}/>
            </div>
            {msgAfiliados&&<div style={{background:C.success+"14",border:`1px solid ${C.success}30`,borderRadius:8,padding:"8px 12px",marginBottom:10,color:C.success,fontSize:12}}>{msgAfiliados}</div>}
            <Btn onClick={salvarConfigAfiliados}><I.Check s={12}/> Salvar Regras</Btn>
          </div>

          <h3 style={{color:C.text,fontSize:14,fontWeight:700,marginBottom:11}}>Afiliados Cadastrados</h3>
          <ST cols={["Nome","CPF","Código","Última Indicação","Status","Ação"]}
            rows={afiliados.map(a=>[
              <span style={{fontWeight:600}}>{a.nome_completo}</span>,
              <span style={{fontSize:11,color:C.muted}}>{a.cpf}</span>,
              <span className="cm" style={{fontWeight:700,color:C.gold,fontSize:12}}>{a.codigo_afiliado}</span>,
              <span style={{fontSize:11}}>{a.ultima_indicacao_em?fmtDate(a.ultima_indicacao_em):"Nenhuma ainda"}</span>,
              <div><Badge text={a.status==="ativo"?"Ativo":"Descredenciado"} color={a.status==="ativo"?C.success:C.danger}/>{a.motivo_descredenciamento&&<div style={{color:C.muted,fontSize:9,marginTop:3}}>{a.motivo_descredenciamento}</div>}</div>,
              a.status==="ativo"
                ? <Btn v="d" onClick={()=>descredenciarAfiliado(a)} style={{fontSize:10,padding:"3px 9px"}}>Descredenciar</Btn>
                : <Btn v="ok" onClick={()=>reativarAfiliado(a)} style={{fontSize:10,padding:"3px 9px"}}>Reativar</Btn>,
            ])}
            empty="Nenhum afiliado cadastrado ainda."
          />

          <h3 style={{color:C.text,fontSize:14,fontWeight:700,margin:"22px 0 11px"}}>Clientes Indicados por Afiliados</h3>
          <ST cols={["Afiliado","Clínica Indicada","Referência","Valor Assinatura","Comissão","Status","Ação"]}
            rows={indicacoesAfiliados.map(ind=>{
              const af = afiliados.find(a=>a.id===ind.afiliado_id);
              return [
                <span style={{fontWeight:600}}>{af?.nome_completo||"—"}</span>,
                <span style={{fontSize:11}}>{ind.clinica_nome}</span>,
                <span style={{fontSize:11}}>{ind.referencia}</span>,
                <span style={{fontSize:11}}>{fmt(ind.valor_assinatura)}</span>,
                <span style={{color:C.accent,fontWeight:700}}>{fmt(ind.comissao_valor)}</span>,
                <Badge text={ind.status==="paga"?"Confirmada":"Pendente"} color={ind.status==="paga"?C.success:C.warn}/>,
                ind.status==="pendente"?<Btn v="ok" onClick={()=>marcarComissaoPaga(ind)} style={{fontSize:10,padding:"3px 9px"}}>Confirmar</Btn>:<span style={{fontSize:10,color:C.muted}}>—</span>,
              ];
            })}
            empty="Nenhuma indicação registrada ainda."
          />

          <h3 style={{color:C.text,fontSize:14,fontWeight:700,margin:"22px 0 11px"}}>Solicitações de Saque</h3>
          <ST cols={["Afiliado","Valor","Data da Solicitação","Status","Ação"]}
            rows={saquesAfiliados.map(s=>{
              const af = afiliados.find(a=>a.id===s.afiliado_id);
              return [
                <span style={{fontWeight:600}}>{af?.nome_completo||"—"}</span>,
                <span style={{color:C.accent,fontWeight:700}}>{fmt(s.valor)}</span>,
                <span style={{fontSize:11}}>{fmtDate(s.data_solicitacao)}</span>,
                <Badge text={s.status==="pago"?"Pago":s.status==="rejeitado"?"Rejeitado":"Aguardando Pix"} color={s.status==="pago"?C.success:s.status==="rejeitado"?C.danger:C.warn}/>,
                s.status==="solicitado"?<Btn v="ok" onClick={()=>marcarSaquePago(s)} style={{fontSize:10,padding:"3px 9px"}}>Marcar Pago</Btn>:<span style={{fontSize:10,color:C.muted}}>{s.data_pagamento?fmtDate(s.data_pagamento):"—"}</span>,
              ];
            })}
            empty="Nenhuma solicitação de saque ainda."
          />
        </>}

        {abaAtiva==="asaas" && <>
          {/* ── ABA CONCILIAÇÃO ASAAS ── */}
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:13,padding:18,marginBottom:18}}>
            <h3 style={{color:C.text,fontSize:14,fontWeight:700,marginBottom:4,display:"flex",alignItems:"center",gap:7}}><I.Bank c={C.accent} s={16}/> Configuração Asaas</h3>
            <p style={{color:C.muted,fontSize:11,marginBottom:12}}>Chave de API usada pela Edge Function para sincronizar cobranças automaticamente (veja nota no final desta página).</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Inp label="Chave de API Asaas" type="password" value={config.asaas_api_key} onChange={e=>setConfig(c=>({...c,asaas_api_key:e.target.value}))} placeholder="$aact_..."/>
              <Sel label="Ambiente" value={config.asaas_ambiente} onChange={e=>setConfig(c=>({...c,asaas_ambiente:e.target.value}))} options={[{value:"sandbox",label:"Sandbox (testes)"},{value:"production",label:"Produção"}]}/>
            </div>
            {msgConfig&&<div style={{background:C.success+"14",border:`1px solid ${C.success}30`,borderRadius:8,padding:"8px 12px",marginTop:8,color:C.success,fontSize:12}}>{msgConfig}</div>}
            <Btn onClick={salvarConfigAsaas} style={{marginTop:10}}><I.Check s={12}/> Salvar Configuração</Btn>
          </div>

          <div className="stat-row" style={{display:"flex",gap:11,marginBottom:18,flexWrap:"wrap"}}>
            <SC label="Recebido no Sistema" value={fmt(totalRecebidoSistema)} Icon={I.Dollar} color={C.accent}/>
            <SC label="Conciliado com o Banco" value={fmt(totalConciliado)} Icon={I.Check} color={C.success}/>
            <SC label="Aguardando Conciliação" value={fmt(totalNaoConciliado)} Icon={I.Warn} color={C.warn}/>
          </div>

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:11}}>
            <h3 style={{color:C.text,fontSize:14,fontWeight:700}}>Pagamentos de Assinatura</h3>
            <Btn onClick={()=>setPagModal(true)}><I.Plus s={12}/> Registrar Pagamento</Btn>
          </div>

          <ST cols={["Clínica","Referência","Vencimento","Valor","Status","Conciliado","Ação"]}
            rows={pagamentos.map(p=>{
              const clinica = clinicas.find(c=>c.id===p.clinica_id);
              return [
                <span style={{fontWeight:600}}>{clinica?.nome||"—"}</span>,
                <span style={{fontSize:11}}>{p.referencia}</span>,
                <span style={{fontSize:11}}>{fmtDate(p.vencimento)}</span>,
                <span style={{color:C.accent,fontWeight:700}}>{fmt(p.valor)}</span>,
                <Badge text={p.status==="pago"?"Pago":p.status==="atrasado"?"Atrasado":"Aberto"} color={p.status==="pago"?C.success:p.status==="atrasado"?C.danger:C.warn}/>,
                p.status==="pago"
                  ? <button onClick={()=>marcarConciliado(p)} style={{background:"none",border:"none",cursor:"pointer"}}>
                      <Badge text={p.conciliado?"✓ Sim":"Não"} color={p.conciliado?C.success:C.muted}/>
                    </button>
                  : <span style={{color:C.muted,fontSize:10}}>—</span>,
                p.status!=="pago"?<Btn v="ok" onClick={()=>marcarPago(p)} style={{fontSize:10,padding:"3px 9px"}}>Marcar pago</Btn>:<span style={{fontSize:10,color:C.muted}}>{fmtDate(p.data_pagamento)}</span>,
              ];
            })}
            empty="Nenhum pagamento registrado ainda."
          />

          {pagModal&&<Mod title="Registrar Pagamento de Assinatura" onClose={()=>setPagModal(null)}>
            <Sel label="Clínica" value={formPag.clinica_id} onChange={e=>setFormPag(f=>({...f,clinica_id:e.target.value}))} options={[{value:"",label:"Selecione..."}, ...clinicas.map(c=>({value:c.id,label:c.nome}))]}/>
            <Inp label="Referência" value={formPag.referencia} onChange={e=>setFormPag(f=>({...f,referencia:e.target.value}))} placeholder="Ex: Junho/2026"/>
            <Inp label="Valor (R$)" type="number" value={formPag.valor} onChange={e=>setFormPag(f=>({...f,valor:e.target.value}))}/>
            <Inp label="Vencimento" type="date" value={formPag.vencimento} onChange={e=>setFormPag(f=>({...f,vencimento:e.target.value}))}/>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <Btn v="g" onClick={()=>setPagModal(null)}>Cancelar</Btn>
              <Btn onClick={registrarPagamento} disabled={!formPag.clinica_id||!formPag.valor}><I.Check s={12}/> Registrar</Btn>
            </div>
          </Mod>}
        </>}

        <div style={{marginTop:16,background:C.info+"10",border:`1px solid ${C.info}25`,borderRadius:10,padding:"11px 14px"}}>
          <div style={{color:C.info,fontSize:11,fontWeight:700,marginBottom:4}}>ℹ Sobre a sincronização automática com o Asaas</div>
          <div style={{color:C.muted,fontSize:11,lineHeight:1.7}}>
            A API do Asaas não pode ser chamada diretamente do navegador por segurança (a chave secreta ficaria exposta). Por enquanto, registre e concilie pagamentos manualmente aqui. A sincronização automática (buscar cobranças e marcar pagas sozinho) requer uma <strong>Supabase Edge Function</strong> — código-servidor que roda protegido, fora deste app React. Posso te ajudar a criar e publicar essa função quando você quiser avançar para a automação completa.
          </div>
        </div>
      </div>

      {/* MODAL DRILL-DOWN DOS KPIs */}
      {drillDown&&<Mod title={drillDown.label} onClose={()=>setDrillDown(null)} full>
        {drillDown.lista.length===0
          ? <p style={{color:C.muted,fontSize:13,textAlign:"center",padding:20}}>Nenhuma clínica nesta categoria.</p>
          : <ST cols={["Clínica","E-mail","Plano","Vencimento","Criada em"]}
              rows={drillDown.lista.map(c=>[
                <span style={{fontWeight:600}}>{c.nome}</span>,
                <span style={{color:C.muted,fontSize:11}}>{c.email}</span>,
                <Badge text={c.plano==="anual"?"Anual":"Mensal"} color={C.info}/>,
                <span style={{fontSize:11}}>{c.acesso_vitalicio?"—":fmtDate(c.contrato_vencimento)}</span>,
                <span style={{fontSize:11}}>{fmtDate(c.created_at)}</span>,
              ])}
            />
        }
        <div style={{marginTop:14,background:C.surface,borderRadius:9,padding:12}}>
          <div style={{color:C.muted,fontSize:11,marginBottom:2}}>Receita potencial deste grupo</div>
          <div style={{color:C.accent,fontWeight:700,fontSize:16}}>{fmt(drillDown.lista.reduce((s,c)=>s+(precoMensal[c.plano]||0),0))}<span style={{fontSize:11,color:C.muted,fontWeight:400}}>/mês</span></div>
        </div>
      </Mod>}

      {/* MODAL BLOQUEIO */}
      {bloqueioModal&&<Mod title={`Bloquear — ${bloqueioModal.nome}`} onClose={()=>setBloqueioModal(null)}>
        <div style={{background:C.danger+"10",border:`1px solid ${C.danger}25`,borderRadius:9,padding:"9px 12px",marginBottom:12}}>
          <span style={{color:C.danger,fontSize:12}}>Ao bloquear, os usuários desta clínica não conseguirão mais acessar o sistema até você desbloquear.</span>
        </div>
        <TA label="Motivo do bloqueio" value={motivoBloqueio} onChange={e=>setMotivoBloqueio(e.target.value)} placeholder="Ex: Inadimplência — fatura de Junho em atraso"/>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Btn v="g" onClick={()=>setBloqueioModal(null)}>Cancelar</Btn>
          <Btn v="d" onClick={confirmarBloqueio}><I.Lock s={12}/> Confirmar Bloqueio</Btn>
        </div>
      </Mod>}
    </div>
  );
}


export default function App() {
  const [tela, setTela] = useState("landing");
  const [user, setUser] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [checkout, setCheckout] = useState(null);

  /* Captura o código de indicação da URL (?ref=CODIGO) e mantém durante a sessão */
  const [refAfiliado] = useState(()=>{
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    return params.get("ref") || "";
  });

  /* Detecta retorno do e-mail de recuperação de senha (#access_token=...&type=recovery) */
  const [recoveryToken, setRecoveryToken] = useState(()=>{
    if (typeof window === "undefined") return null;
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    return hash.get("type") === "recovery" ? hash.get("access_token") : null;
  });
  const limparRecovery = () => {
    setRecoveryToken(null);
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    setShowLogin(true);
  };

  const handleLogin = u => { setUser(u); setShowLogin(false); setTela(u.isSuperAdmin ? "painel_admin" : u.isAfiliado ? "area_afiliado" : "sistema"); };
  const handleLogout = () => { setUser(null); setTela("landing"); };
  const handleCheckoutSuccess = u => { setUser(u); setCheckout(null); setTela("sistema"); };

  return (
    <>
      <GS/>
      {tela==="landing" && <Landing onLogin={()=>setShowLogin(true)} onCheckout={p=>setCheckout(p)}/>}
      {tela==="sistema" && user && <Sistema user={user} onLogout={handleLogout}/>}
      {tela==="painel_admin" && user && <PainelAdmin user={user} onLogout={handleLogout}/>}
      {tela==="area_afiliado" && user && <AreaAfiliado user={user} onLogout={handleLogout}/>}
      {showLogin && <LoginModal onClose={()=>setShowLogin(false)} onLogin={handleLogin} onGoSignup={()=>{setShowLogin(false);setCheckout("anual");}}/>}
      {checkout && <CheckoutModal plan={checkout} onClose={()=>setCheckout(null)} onSuccess={handleCheckoutSuccess} codigoAfiliado={refAfiliado}/>}
      {recoveryToken && <ResetPasswordModal accessToken={recoveryToken} onDone={limparRecovery}/>}
    </>
  );
}

