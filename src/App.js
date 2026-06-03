import { useState, useEffect, useRef, useCallback, useMemo } from "react";

/* ─── CONFIG — altere apenas estas duas linhas ────────────────── */
const SUPABASE_URL = "https://qeipimijviakflqkipiv.supabase.co";
const SUPABASE_KEY = "sb_publishable_9zNFv1WKK-wf_Oz2GH-5-Q_XcA092xo";

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

  /* Cadastro de novo usuário */
  async signup(email, senha) {
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY },
        body: JSON.stringify({ email, password: senha }),
      });
      const dados = await r.json();
      if (dados.error) return { erro: dados.msg || dados.error };
      return { ok: true, userId: dados.user?.id };
    } catch (e) { return { erro: "Erro de conexão." }; }
  },
};

/* ─── TEMAS ──────────────────────────────────────────────────── */
const T = { bg:"#060608",surface:"#0D0D12",card:"#12121A",border:"#1E1E2E",gold:"#C8A96A",goldLt:"#E2CA96",goldDk:"#8A6F3A",muted:"#6A6A80",mutedLt:"#9A9AB0",danger:"#FF5A5A",success:"#3EC8A8",text:"#EEEAE4" };
const C = { bg:"#0A0A0F",surface:"#13131A",card:"#1A1A24",border:"#252535",accent:"#C9A96E",accentSoft:"#C9A96E18",text:"#F0EDE8",muted:"#7A7A8A",success:"#3ECFB2",danger:"#FF6B6B",info:"#6B9FFF",purple:"#A87BFF",warn:"#F5A623" };

/* ─── DEMO DATA ──────────────────────────────────────────────── */
const DEMO_USERS = [
  {id:"demo-1",email:"demo@clinica.com",senha:"demo123",clinica:"Studio Demo",plano:"anual"},
  {id:"demo-2",email:"admin@estetica.com",senha:"admin123",clinica:"Clínica Lumière",plano:"mensal"},
];
const mkDemo = () => ({
  profissionais:[
    {id:1,nome:"Dra. Camila Rocha",especialidade:"Harmonização Facial",tipo:"percentual",percentual:40,cor:"#C9A96E",email:"camila@clinica.com",telefone:"(11)99999-1111",ativo:true},
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
    {id:1,paciente_id:1,paciente:"Ana Paula Silva",procedimento_id:1,servico:"Botox Facial",profissional_id:1,data:"2025-05-27",hora:"09:00",status:"confirmado",valor:800},
    {id:2,paciente_id:2,paciente:"Beatriz Costa",procedimento_id:3,servico:"Limpeza de Pele",profissional_id:3,data:"2025-05-27",hora:"10:30",status:"aguardando",valor:250},
    {id:3,paciente_id:3,paciente:"Carla Mendonça",procedimento_id:2,servico:"Preenchimento Labial",profissional_id:1,data:"2025-05-27",hora:"14:00",status:"confirmado",valor:1200},
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
  contas_receber:[
    {id:1,atendimento_id:4,paciente_id:1,paciente:"Ana Paula Silva",descricao:"Drenagem Linfática",valor:180,vencimento:"2025-05-30",status:"aberto",forma_pagamento:"PIX",conta_id:null},
  ],
  contas_pagar:[
    {id:1,fornecedor:"DermaSupply",descricao:"Pedido #1204 — insumos",categoria:"Insumos",valor:2800,vencimento:"2025-06-05",status:"aberto",conta_id:null},
    {id:2,fornecedor:"",descricao:"Aluguel Junho",categoria:"Imóvel",valor:6000,vencimento:"2025-06-05",status:"aberto",conta_id:null},
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
  compra_itens:[
    {id:1,conta_pagar_id:1,produto_id:1,quantidade:5,custo_unitario:800,custo_total:4000,fornecedor_id:1,data:"2025-05-01"},
    {id:2,conta_pagar_id:1,produto_id:2,quantidade:8,custo_unitario:250,custo_total:2000,fornecedor_id:1,data:"2025-05-01"},
  ],
});

/* ─── UTILS ──────────────────────────────────────────────────── */
const fmt = v => (Number(v)||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const fmtN = v => (Number(v)||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const today = () => new Date().toISOString().split("T")[0];
const fmtDate = d => d?new Date(d+"T12:00:00").toLocaleDateString("pt-BR"):"-";
const _fmtDateISO = d => { if(!d)return""; const p=d.split("/"); return p.length===3?`${p[2]}-${p[1]}-${p[0]}`:d; }; // eslint-disable-line
const maskCPF = v => v.replace(/\D/g,"").slice(0,11).replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d{1,2})$/,"$1-$2");
const maskFone = v => v.replace(/\D/g,"").slice(0,11).replace(/(\d{2})(\d{5})(\d)/,"($1) $2-$3");
const maskCNPJ = v => v.replace(/\D/g,"").slice(0,14).replace(/(\d{2})(\d)/,"$1.$2").replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d)/,"$1/$2").replace(/(\d{4})(\d{1,2})$/,"$1-$2");
const maskCEP = v => v.replace(/\D/g,"").slice(0,8).replace(/(\d{5})(\d)/,"$1-$2");


/* ─── ÍCONES ─────────────────────────────────────────────────── */
const I = {
  Sparkle:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill={c} stroke="none"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>,
  Grid:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  Cal:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  User:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Users:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Up:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  Dollar:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  Plus:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Check:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  X:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Tag:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  Box:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  Receipt:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/></svg>,
  Send:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  Warn:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  Eye:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  EyeOff:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  File:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  Download:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  Edit:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Lock:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  Out:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Arrow:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  Shield:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Star:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill={c} stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  Zap:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  Menu:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  Bar:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  Phone:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.73 16z"/></svg>,
  Diamond:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41L13.7 2.71a2.41 2.41 0 0 0-3.41 0L2.7 10.3z"/></svg>,
  Scissors:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>,
  Truck:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  Bank:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>,
  Clipboard:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>,
  Megaphone:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>,
  Settings:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  Calculator:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="12" y1="10" x2="14" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="12" y1="14" x2="14" y2="14"/><line x1="16" y1="14" x2="16" y2="18"/><line x1="8" y1="18" x2="10" y2="18"/><line x1="12" y1="18" x2="14" y2="18"/></svg>,
  Refresh:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
  Filter:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  Whatsapp:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill={c} stroke="none"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.5 2C6.262 2 2 6.262 2 11.5c0 1.869.524 3.617 1.438 5.105L2 22l5.535-1.42C9.004 21.491 10.22 22 11.5 22c5.238 0 9.5-4.262 9.5-9.5S16.738 2 11.5 2zm0 17.4c-1.599 0-3.086-.483-4.325-1.309l-.31-.186-3.286.843.874-3.197-.203-.328A7.895 7.895 0 0 1 3.6 11.5C3.6 7.14 7.14 3.6 11.5 3.6S19.4 7.14 19.4 11.5 15.86 19.4 11.5 19.4z"/></svg>,
  Email:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  Excel:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  Pen:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>,
  ShoppingCart:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
  CreditCard:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  ArrowUpDown:({c="currentColor",s=16})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>,
};

/* ─── CSS ────────────────────────────────────────────────────── */
const GS = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
    body{background:#060608;font-family:'DM Sans',sans-serif;overflow-x:hidden;color:#EEEAE4}
    .cm{font-family:'Cormorant Garamond',serif}
    @keyframes fu{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
    @keyframes fi{from{opacity:0}to{opacity:1}}
    @keyframes gl{0%,100%{box-shadow:0 0 18px #C8A96A28}50%{box-shadow:0 0 42px #C8A96A55}}
    @keyframes sp{from{transform:rotate(0)}to{transform:rotate(360deg)}}
    @keyframes sk{0%,100%{transform:translateX(0)}25%,75%{transform:translateX(-5px)}50%{transform:translateX(5px)}}
    .fu{animation:fu .55s ease both}
    .fi{animation:fi .3s ease both}
    .gl{animation:gl 2.5s ease infinite}
    .sp{animation:sp 1s linear infinite}
    .sk{animation:sk .35s ease}
    .d1{animation-delay:.07s}.d2{animation-delay:.14s}.d3{animation-delay:.21s}.d4{animation-delay:.28s}.d5{animation-delay:.35s}
    ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:#0A0A0F}::-webkit-scrollbar-thumb{background:#8A6F3A;border-radius:3px}
    input,select,textarea{-webkit-appearance:none;appearance:none;font-family:'DM Sans',sans-serif;font-size:16px}
    input:focus,select:focus,textarea:focus{outline:none!important;border-color:#C8A96A!important;box-shadow:0 0 0 2px #C8A96A18}
    button{cursor:pointer;font-family:'DM Sans',sans-serif;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
    /* hover effects */
    .gb:hover{background:#E2CA96!important;transform:translateY(-1px)}
    .ob:hover{background:#C8A96A12!important;border-color:#C8A96A!important;color:#E2CA96!important}
    .nb:hover{background:#C9A96E18!important;color:#C9A96E!important}
    .fc:hover{border-color:#C8A96A55!important;transform:translateY(-2px)}
    .nl:hover{color:#E2CA96!important}
    *{transition:color .15s,border-color .15s,background .18s,transform .18s,box-shadow .18s,opacity .15s}
    /* Barra mobile */
    .bottom-nav{display:none;position:fixed;bottom:0;left:0;right:0;z-index:900;background:#13131A;border-top:1px solid #252535;padding:6px 0 env(safe-area-inset-bottom,6px);justify-content:space-around;align-items:center}
    .bn-item{display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px 8px;border:none;background:transparent;color:#7A7A8A;font-size:9px;font-weight:500;min-width:48px;border-radius:8px}
    .bn-item.active{color:#C9A96E}
    /* Responsive */
    @media(min-width:769px){.sys-sidebar{display:flex!important}.bottom-nav{display:none!important}.sys-content{padding-bottom:16px!important}}
    @media(max-width:768px){.hs{display:none!important}.cs{flex-direction:column!important}.ws{width:100%!important}.g1{grid-template-columns:1fr!important}.g2{grid-template-columns:1fr 1fr!important}.ht{font-size:clamp(30px,8vw,52px)!important}.sys-sidebar{display:none!important}.bottom-nav{display:flex!important}.sys-content{padding-bottom:76px!important}.sys-topbar-menu{display:none!important}}
    @media(max-width:480px){.g2{grid-template-columns:1fr!important}.stat-row>div{min-width:calc(50% - 6px)!important;flex:1 1 calc(50% - 6px)!important}.hero-btns{flex-direction:column!important;align-items:stretch!important}.hero-btns button{width:100%!important;justify-content:center!important}}
    /* Signature pad */
    .sig-canvas{border:1.5px solid #252535;border-radius:10px;width:100%;height:160px;background:#13131A;cursor:crosshair;touch-action:none}
  `}</style>
);


/* ─── UI PRIMITIVOS ──────────────────────────────────────────── */
const Spin = ({s=16,c="#fff"})=><div className="sp" style={{width:s,height:s,border:`2px solid ${c}28`,borderTop:`2px solid ${c}`,borderRadius:"50%",flexShrink:0}}/>;
const Badge = ({text,color})=><span style={{background:color+"20",color,padding:"2px 9px",borderRadius:20,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:.4,whiteSpace:"nowrap"}}>{text}</span>;

const SC = ({label,value,Icon,color,sub})=>(
  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:13,padding:"14px 16px",flex:1,minWidth:120}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
      <div>
        <div style={{color:C.muted,fontSize:10,textTransform:"uppercase",letterSpacing:.8,marginBottom:5}}>{label}</div>
        <div style={{color:C.text,fontSize:17,fontWeight:700}}>{value}</div>
        {sub&&<div style={{color:C.muted,fontSize:10,marginTop:2}}>{sub}</div>}
      </div>
      {Icon&&<div style={{background:color+"20",borderRadius:9,padding:7}}><Icon c={color} s={14}/></div>}
    </div>
  </div>
);

const Mod = ({title,onClose,children,wide,full})=>(
  <div style={{position:"fixed",inset:0,background:"#000000BB",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(4px)"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div className="fi" style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:22,width:full?"95vw":wide?700:460,maxWidth:"98vw",maxHeight:"92vh",overflowY:"auto"}}>
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
  const vs={p:{background:C.accent,color:"#0A0A0F",border:"none"},g:{background:"transparent",color:C.muted,border:`1px solid ${C.border}`},d:{background:C.danger+"20",color:C.danger,border:`1px solid ${C.danger}44`},ok:{background:C.success+"20",color:C.success,border:`1px solid ${C.success}44`},i:{background:C.info+"20",color:C.info,border:`1px solid ${C.info}44`},warn:{background:C.warn+"20",color:C.warn,border:`1px solid ${C.warn}44`}};
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

/* ─── TABELA ─────────────────────────────────────────────────── */
const ST = ({cols,rows,empty="Nenhum registro encontrado."})=>(
  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:13,overflow:"hidden"}}>
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",minWidth:460}}>
        <thead><tr style={{background:C.surface}}>
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
        contas_receber, contas_pagar,
        movimentacoes, estoque_movimentacoes,
        campanhas, atendimento_itens, compra_itens,
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
        sb.get("movimentacoes",       `clinica_id=eq.${cid}&order=data.desc`),
        sb.get("estoque_movimentacoes",`clinica_id=eq.${cid}&order=data.desc`),
        sb.get("campanhas",           `clinica_id=eq.${cid}&order=created_at.desc`),
        sb.get("atendimento_itens",   `clinica_id=eq.${cid}`),
        sb.get("compra_itens",        `clinica_id=eq.${cid}`),
      ]);

      setData({
        profissionais, fornecedores, produtos, procedimentos,
        procedimento_insumos, formas_pagamento, contas_bancarias,
        pacientes, anamneses, agendamentos, atendimentos,
        despesas_fixas, despesas_variaveis,
        contas_receber, contas_pagar,
        movimentacoes, estoque_movimentacoes,
        campanhas, atendimento_itens, compra_itens,
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
    /* Tabelas que não têm clinica_id (tabelas de join simples) */
    const semClinica = ["procedimento_insumos","atendimento_itens","compra_itens"];
    const comClinica = semClinica.includes(tabela) ? registro : { ...registro, clinica_id: clinicaId };

    if (DEMO_MODE) {
      const novo = { ...comClinica, id: Date.now() };
      setData(prev => ({ ...prev, [tabela]: [...(prev[tabela] || []), novo] }));
      return novo;
    }
    const criado = await sb.post(tabela, comClinica);
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
  const ChkBox = ({label,k})=>(
    <label style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",padding:"5px 0"}}>
      <input type="checkbox" checked={!!form[k]} onChange={()=>toggle(k)} style={{width:15,height:15,accentColor:C.accent}}/>
      <span style={{color:C.text,fontSize:13}}>{label}</span>
    </label>
  );
  const Radio = ({label,k,value})=>( // eslint-disable-line no-unused-vars
    <label style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",padding:"4px 0"}}>
      <input type="radio" name={k} value={value} checked={form[k]===value} onChange={()=>f(k,value)} style={{accentColor:C.accent}}/>
      <span style={{color:C.text,fontSize:13}}>{label}</span>
    </label>
  );

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
          <ChkBox label="Problemas cardíacos" k="problemas_cardiacos"/>
          <ChkBox label="Diabetes" k="diabetes"/>
          <ChkBox label="Hipertensão" k="hipertensao"/>
          <ChkBox label="Tireoide" k="tireoide"/>
          <ChkBox label="Epilepsia" k="epilepsia"/>
          <ChkBox label="Gestante" k="gestante"/>
          <ChkBox label="Amamentando" k="amamentando"/>
          <ChkBox label="Tratamento oncológico" k="oncologico"/>
          <ChkBox label="Doença autoimune" k="autoimune"/>
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
          <ChkBox label="Manchas" k="manchas"/>
          <ChkBox label="Acne ativa" k="acne"/>
          <ChkBox label="Cicatrizes" k="cicatrizes"/>
          <ChkBox label="Usa ácidos" k="uso_acido"/>
          <ChkBox label="Usa retinol" k="uso_retinol"/>
          <ChkBox label="Protetor solar diário" k="protetor_solar"/>
        </div>
        <TA label="Procedimentos estéticos anteriores" value={form.procedimentos_anteriores} onChange={e=>f("procedimentos_anteriores",e.target.value)} placeholder="Botox, preenchimento, laser, peelings..."/>
        <TA label="Reações a procedimentos anteriores" value={form.reacoes_anteriores} onChange={e=>f("reacoes_anteriores",e.target.value)} placeholder="Alergias, irritações, inchaços..."/>
      </div>}

      {step===4&&<div className="fu">
        <h4 style={{color:C.accent,fontSize:12,fontWeight:700,marginBottom:12,textTransform:"uppercase",letterSpacing:1}}>Hábitos de Vida</h4>
        <ChkBox label="Fumante" k="fumante"/>
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

  const doLogin = async () => {
    if (!email || !senha) { setErro("Preencha e-mail e senha."); return; }
    setLoading(true); setErro("");

    /* ── Modo demo ── */
    if (DEMO_MODE) {
      await new Promise(r => setTimeout(r, 800));
      const u = DEMO_USERS.find(u => u.email === email && u.senha === senha);
      if (u) { onLogin(u); return; }
      setErro("Credenciais incorretas.\nUse: demo@clinica.com / demo123");
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

    /* Busca perfil da clínica — clinica_id = auth.uid do Supabase */
    const perfis = await sb.get("clinicas", `email=eq.${encodeURIComponent(email)}`);
    const perfil = perfis?.[0];

    onLogin({
      id: auth.userId,          /* CRUCIAL: este é o clinica_id usado em todas as queries */
      email: auth.email || email,
      clinica: perfil?.nome || email,
      plano: perfil?.plano || "mensal",
      token: auth.token,
    });
  };

  return (
    <div style={{position:"fixed",inset:0,background:"#000000CC",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(8px)"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="fu" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:20,width:"100%",maxWidth:380,overflow:"hidden"}}>

        <div style={{background:"linear-gradient(135deg,#C8A96A10,transparent)",padding:"22px 24px 16px",borderBottom:`1px solid ${T.border}`,textAlign:"center"}}>
          <div style={{width:42,height:42,borderRadius:"50%",background:"#C8A96A16",border:"1px solid #C8A96A38",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 10px"}}>
            <I.Sparkle c={T.gold} s={20}/>
          </div>
          <div className="cm" style={{fontSize:20,fontWeight:600,color:T.text}}>Estética<span style={{color:T.gold}}>Pro</span></div>
          <div style={{color:T.mutedLt,fontSize:12,marginTop:2}}>Entre com sua conta</div>
          {DEMO_MODE && (
            <div style={{marginTop:8,background:"#C8A96A14",border:"1px solid #C8A96A30",borderRadius:7,padding:"6px 10px",fontSize:10,color:T.gold}}>
              Modo demonstração · demo@clinica.com / demo123
            </div>
          )}
        </div>

        <div className={shake?"sk":""} style={{padding:"18px 24px"}}>
          {erro && (
            <div className="fi" style={{background:"#FF5A5A14",border:"1px solid #FF5A5A30",borderRadius:9,padding:"9px 12px",marginBottom:12,display:"flex",gap:7,alignItems:"flex-start"}}>
              <I.Warn c={T.danger} s={14}/>
              <span style={{color:T.danger,fontSize:11,lineHeight:1.5,whiteSpace:"pre-line"}}>{erro}</span>
            </div>
          )}

          <div style={{marginBottom:12}}>
            <label style={{display:"block",color:T.mutedLt,fontSize:10,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>E-mail</label>
            <input type="email" placeholder="seu@email.com" value={email}
              onChange={e=>setEmail(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&doLogin()}
              style={{width:"100%",background:T.surface,border:`1px solid ${T.border}`,borderRadius:9,padding:"10px 12px",color:T.text,fontSize:14}}/>
          </div>

          <div style={{marginBottom:18}}>
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

          <button className="gb gl" onClick={doLogin} disabled={loading}
            style={{width:"100%",background:T.gold,color:T.bg,border:"none",borderRadius:10,padding:"12px",fontWeight:700,fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",gap:8,cursor:"pointer"}}>
            {loading ? <><Spin c={T.bg}/>Verificando...</> : "Entrar no sistema →"}
          </button>

          <div style={{textAlign:"center",marginTop:14}}>
            <span style={{color:T.muted,fontSize:12}}>Não tem conta? </span>
            <button onClick={onGoSignup} style={{background:"none",border:"none",color:T.gold,fontSize:12,fontWeight:600,cursor:"pointer"}}>Assinar agora</button>
          </div>
        </div>

        <div style={{padding:"0 24px 16px",textAlign:"center"}}>
          <button onClick={onClose} style={{background:"none",border:"none",color:T.muted,fontSize:12,cursor:"pointer"}}>← Voltar</button>
        </div>
      </div>
    </div>
  );
}

function CheckoutModal({plan,onClose,onSuccess}) {
  const [step,setStep]=useState(1);const [form,setForm]=useState({clinica:"",nome:"",email:"",telefone:"",senha:"",cartao:"",validade:"",cvv:"",titular:""});const [errs,setErrs]=useState({});const [loading,setLoading]=useState(false);const [showS,setShowS]=useState(false);
  const anual=plan==="anual";const preco=anual?"3.990,00":"399,00";const f=(k,v)=>setForm(p=>({...p,[k]:v}));
  const validate=()=>{const e={};if(step===1){if(!form.clinica.trim())e.clinica="Obrigatório";if(!form.nome.trim())e.nome="Obrigatório";if(!form.email.includes("@"))e.email="Inválido";if(form.telefone.replace(/\D/g,"").length<10)e.telefone="Inválido";if(form.senha.length<6)e.senha="Mín. 6 caracteres";}if(step===2){if(form.cartao.replace(/\s/g,"").length<16)e.cartao="Inválido";if(!form.validade.includes("/"))e.validade="MM/AA";if(form.cvv.length<3)e.cvv="Inválido";if(!form.titular.trim())e.titular="Obrigatório";}setErrs(e);return Object.keys(e).length===0;};
  const next = async () => {
    if (!validate()) return;
    if (step === 1) { setStep(2); return; }
    setLoading(true);
    if (DEMO_MODE) {
      await new Promise(r => setTimeout(r, 1500));
      DEMO_USERS.push({id:"demo-"+Date.now(),email:form.email,senha:form.senha,clinica:form.clinica,plano:plan});
      setLoading(false); setStep(3); return;
    }
    const auth = await sb.signup(form.email, form.senha);
    if (auth.erro) { setErrs({email:auth.erro}); setLoading(false); return; }
    if (auth.userId) {
      await sb.post("clinicas", {
        id: auth.userId,
        email: form.email, nome: form.clinica,
        responsavel: form.nome, telefone: form.telefone,
        plano: plan, created_at: new Date().toISOString(),
      });
    }
    setLoading(false); setStep(3);
  };
  const mCard=v=>v.replace(/\D/g,"").slice(0,16).replace(/(.{4})/g,"$1 ").trim();const mVal=v=>v.replace(/\D/g,"").slice(0,4).replace(/(\d{2})(\d)/,"$1/$2");
  const LF=({label,k,ph,mask,type="text",half})=>(
    <div style={{flex:half?"1 1 45%":"1 1 100%",minWidth:half?100:"auto"}}>
      <label style={{display:"block",color:T.mutedLt,fontSize:10,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>{label}</label>
      <div style={{position:"relative"}}><input type={k==="senha"&&!showS?"password":type} placeholder={ph} value={form[k]} onChange={e=>f(k,mask?mask(e.target.value):e.target.value)} style={{width:"100%",background:T.surface,border:`1px solid ${errs[k]?T.danger:T.border}`,borderRadius:8,padding:k==="senha"?"10px 38px 10px 12px":"10px 12px",color:T.text,fontSize:13}}/>
        {k==="senha"&&<button type="button" onClick={()=>setShowS(!showS)} style={{position:"absolute",right:9,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:T.muted}}>{showS?<I.EyeOff c={T.muted} s={13}/>:<I.Eye c={T.muted} s={13}/>}</button>}
      </div>{errs[k]&&<span style={{color:T.danger,fontSize:10,marginTop:2,display:"block"}}>{errs[k]}</span>}
    </div>
  );
  return(
    <div style={{position:"fixed",inset:0,background:"#000000CC",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(8px)"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="fu" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:20,width:"100%",maxWidth:480,maxHeight:"92vh",overflowY:"auto"}}>
        <div style={{padding:"16px 21px 12px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div className="cm" style={{fontSize:18,fontWeight:600,color:T.text}}>Estética<span style={{color:T.gold}}>Pro</span></div><div style={{color:T.gold,fontSize:11,marginTop:1}}>Plano {anual?"Anual":"Mensal"} — R$ {preco}/{anual?"ano":"mês"}</div></div>
          <button onClick={onClose} style={{background:"none",border:"none",color:T.muted}}><I.X c={T.muted} s={17}/></button>
        </div>
        <div style={{display:"flex",alignItems:"center",padding:"11px 21px",borderBottom:`1px solid ${T.border}`}}>
          {[["1","Dados"],["2","Pagamento"],["3","Ativado!"]].map(([n,label],i)=>(
            <div key={n} style={{display:"flex",alignItems:"center",flex:i<2?1:"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:22,height:22,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,background:step>i?T.gold:step===i+1?`${T.gold}25`:T.surface,color:step>i?T.bg:step===i+1?T.gold:T.muted,border:`1px solid ${step>=i+1?T.gold:T.border}`}}>{step>i?<I.Check c={T.bg} s={11}/>:n}</div>
                <span style={{color:step===i+1?T.gold:T.muted,fontSize:10,fontWeight:step===i+1?600:400}}>{label}</span>
              </div>{i<2&&<div style={{flex:1,height:1,background:step>i+1?T.gold:T.border,margin:"0 7px"}}/>}
            </div>
          ))}
        </div>
        <div style={{padding:"16px 21px"}}>
          {step===1&&<div className="fu"><div style={{display:"flex",flexWrap:"wrap",gap:10}}><LF label="Nome da Clínica" k="clinica" ph="Ex: Studio Lumière"/><LF label="Seu nome" k="nome" ph="Responsável"/><LF label="E-mail" k="email" ph="seu@email.com" type="email"/><LF label="WhatsApp" k="telefone" ph="(11) 99999-9999" mask={maskFone}/><LF label="Senha de acesso" k="senha" ph="Mín. 6 caracteres"/></div></div>}
          {step===2&&<div className="fu">
            <div style={{background:`${T.gold}10`,border:`1px solid ${T.gold}28`,borderRadius:9,padding:"10px 12px",marginBottom:13,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{color:T.text,fontWeight:600,fontSize:12}}>Plano {anual?"Anual":"Mensal"}</div>{anual&&<div style={{color:T.success,fontSize:10,marginTop:1}}>Economize R$ 798 vs. mensal</div>}</div>
              <div style={{color:T.gold,fontWeight:700,fontSize:16}}>R$ {preco}</div>
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:10}}><LF label="Número do cartão" k="cartao" ph="0000 0000 0000 0000" mask={mCard}/><LF label="Nome no cartão" k="titular" ph="Como aparece no cartão"/><LF label="Validade" k="validade" ph="MM/AA" mask={mVal} half/><LF label="CVV" k="cvv" ph="123" half/></div>
            <div style={{display:"flex",alignItems:"center",gap:7,marginTop:9}}><I.Lock c={T.success} s={12}/><span style={{color:T.success,fontSize:11}}>SSL 256-bit — pagamento seguro</span></div>
          </div>}
          {step===3&&<div className="fu" style={{textAlign:"center",padding:"10px 0"}}>
            <div style={{width:58,height:58,borderRadius:"50%",background:`${T.success}18`,border:`1.5px solid ${T.success}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}><I.Check c={T.success} s={26}/></div>
            <div className="cm" style={{fontSize:22,fontWeight:600,color:T.text,marginBottom:6}}>Bem-vinda, {form.clinica}!</div>
            <div style={{background:T.surface,borderRadius:10,padding:12,textAlign:"left",marginBottom:16}}>
              {[`Login: ${form.email}`,"5 usuários incluídos","Todos os módulos ativos","Suporte WhatsApp"].map(t=><div key={t} style={{display:"flex",alignItems:"center",gap:7,marginBottom:6}}><I.Check c={T.success} s={12}/><span style={{color:T.text,fontSize:12}}>{t}</span></div>)}
            </div>
            <button className="gb gl" onClick={()=>onSuccess({email:form.email,senha:form.senha,clinica:form.clinica,plano:plan})} style={{width:"100%",background:T.gold,color:T.bg,border:"none",borderRadius:10,padding:"12px",fontWeight:700,fontSize:14}}>Acessar o Sistema →</button>
          </div>}
        </div>
        {step<3&&<div style={{padding:"0 21px 16px"}}>
          <button className="gb gl" onClick={next} disabled={loading} style={{width:"100%",background:T.gold,color:T.bg,border:"none",borderRadius:10,padding:"12px",fontWeight:700,fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            {loading?<><Spin c={T.bg}/>Processando...</>:step===1?"Continuar →":"Ativar assinatura →"}
          </button>
          <p style={{color:T.muted,fontSize:10,textAlign:"center",marginTop:7}}>{anual?"Cobrança anual":"Cancele a qualquer momento"}</p>
        </div>}
      </div>
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
  const tf=data.despesas_fixas.reduce((s,d)=>s+(Number(d.valor)||0),0);
  const tv=data.despesas_variaveis.reduce((s,d)=>s+(Number(d.valor)||0),0);
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
        <p style={{color:C.muted,fontSize:12}}>EstéticaPro v3.0</p>
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
  const [filt,setFilt]=useState({status:"",profissional:"",procedimento:"",de:"",ate:""});
  const ff=(k,v)=>setFilt(p=>({...p,[k]:v}));
  const [form,setForm]=useState({paciente:"",procedimento_id:"",servico:"",profissional_id:"",data:today(),hora:"09:00",status:"aguardando",observacoes:""});

  const lista=useMemo(()=>{
    let l=[...data.agendamentos];
    if(filt.status) l=l.filter(a=>a.status===filt.status);
    if(filt.profissional) l=l.filter(a=>String(a.profissional_id)===filt.profissional);
    if(filt.procedimento) l=l.filter(a=>String(a.procedimento_id)===filt.procedimento);
    if(filt.de) l=l.filter(a=>a.data>=filt.de);
    if(filt.ate) l=l.filter(a=>a.data<=filt.ate);
    return l.sort((a,b)=>a.data.localeCompare(b.data)||a.hora.localeCompare(b.hora));
  },[data.agendamentos,filt]);

  const salvar=async()=>{const proc=data.procedimentos.find(p=>p.id===parseInt(form.procedimento_id));await insert("agendamentos",{...form,profissional_id:parseInt(form.profissional_id),procedimento_id:parseInt(form.procedimento_id),servico:proc?.nome||form.servico,valor:proc?.preco_venda||0});setModal(false);};
  const confirmar=id=>update("agendamentos",id,{status:"confirmado"});
  const cancelar=id=>update("agendamentos",id,{status:"cancelado"});
  const realizar=async ag=>{await insert("atendimentos",{paciente:ag.paciente,paciente_id:ag.paciente_id,procedimento_id:ag.procedimento_id,servico:ag.servico,profissional_id:ag.profissional_id,data:ag.data,valor:ag.valor,valor_final:ag.valor,desconto:0,pago:false,forma_pagamento:"",observacoes:""});await update("agendamentos",ag.id,{status:"realizado"});};
  const sc={confirmado:C.success,aguardando:C.warn,cancelado:C.danger,realizado:C.purple};

  return(
    <div>
      <PH title="Agendamentos" sub={`${lista.length} de ${data.agendamentos.length} registros`}><Btn onClick={()=>setModal(true)}><I.Plus s={12}/> Novo</Btn></PH>
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
      {modal&&<Mod title="Novo Agendamento" onClose={()=>setModal(false)}>
        <Inp label="Paciente" value={form.paciente} onChange={e=>setForm(f=>({...f,paciente:e.target.value}))} placeholder="Nome do paciente"/>
        <Sel label="Procedimento" value={form.procedimento_id} onChange={e=>{const proc=data.procedimentos.find(p=>p.id===parseInt(e.target.value));setForm(f=>({...f,procedimento_id:e.target.value,servico:proc?.nome||""}));}} options={[{value:"",label:"Selecione..."}, ...data.procedimentos.filter(p=>p.ativo).map(p=>({value:p.id,label:`${p.nome} — ${fmt(p.preco_venda)}`}))]}/>
        <Sel label="Profissional" value={form.profissional_id} onChange={e=>setForm(f=>({...f,profissional_id:e.target.value}))} options={[{value:"",label:"Selecione..."}, ...data.profissionais.map(p=>({value:p.id,label:p.nome}))]}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Inp label="Data" type="date" value={form.data} onChange={e=>setForm(f=>({...f,data:e.target.value}))}/>
          <Inp label="Hora" type="time" value={form.hora} onChange={e=>setForm(f=>({...f,hora:e.target.value}))}/>
        </div>
        <TA label="Observações" value={form.observacoes} onChange={e=>setForm(f=>({...f,observacoes:e.target.value}))} placeholder="Observações sobre o agendamento..."/>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}>
          <Btn v="g" onClick={()=>setModal(false)}>Cancelar</Btn>
          <Btn onClick={salvar} disabled={!form.paciente||!form.procedimento_id||!form.profissional_id}><I.Check s={12}/> Agendar</Btn>
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

  const toggle = id => { const at=data.atendimentos.find(a=>a.id===id); update("atendimentos",id,{pago:!at.pago}); };

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
    await insert("contas_receber",{
      paciente:cab.paciente, paciente_id:parseInt(cab.paciente_id),
      atendimento_id:atId,
      descricao:`Atendimento — ${descNomes}`,
      valor:valorFinal, vencimento:cab.data,
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
          <Sel label="Paciente" value={cab.paciente_id}
            onChange={e=>{const pac=data.pacientes.find(p=>p.id===parseInt(e.target.value));fc("paciente_id",e.target.value);fc("paciente",pac?.nome||"");}}
            options={[{value:"",label:"Selecione o paciente..."}, ...data.pacientes.map(p=>({value:p.id,label:p.nome}))]}/>
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
function Pacientes({data,insert,update}) {
  const [modal,setModal]=useState(false);
  const [ficha,setFicha]=useState(null);
  const [anamneseModal,setAnamneseModal]=useState(null);
  const [filt,setFilt]=useState({busca:"",tag:""});
  const ff=(k,v)=>setFilt(p=>({...p,[k]:v}));
  const [form,setForm]=useState({nome:"",cpf:"",telefone:"",whatsapp:"",email:"",nascimento:"",sexo:"",profissao:"",endereco:"",cidade:"",estado:"",cep:"",como_conheceu:"",observacoes:""});

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
            <Btn v="g" onClick={()=>setFicha(p)} style={{padding:"3px 7px"}}><I.Eye s={11}/></Btn>
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
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <h4 style={{color:C.text,fontSize:12,fontWeight:700}}>Histórico de Atendimentos</h4>
          <Btn v={data.anamneses.find(a=>a.paciente_id===ficha.id)?"ok":"warn"} onClick={()=>{setFicha(null);setAnamneseModal(ficha);}} style={{fontSize:10,padding:"4px 10px"}}>
            {data.anamneses.find(a=>a.paciente_id===ficha.id)?"✓ Ver Anamnese":"+ Preencher Anamnese"}
          </Btn>
        </div>
        {data.atendimentos.filter(a=>a.paciente_id===ficha.id||a.paciente===ficha.nome).length===0
          ?<p style={{color:C.muted,fontSize:12}}>Sem atendimentos registrados.</p>
          :data.atendimentos.filter(a=>a.paciente_id===ficha.id||a.paciente===ficha.nome).map(at=>{const p=data.profissionais.find(p=>p.id===at.profissional_id);return(
            <div key={at.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:C.surface,borderRadius:8,marginBottom:6}}>
              <div><div style={{color:C.text,fontSize:12,fontWeight:600}}>{at.servico}</div><div style={{color:C.muted,fontSize:10}}>{fmtDate(at.data)} · {p?.nome} · {at.forma_pagamento||"—"}</div></div>
              <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{color:C.accent,fontWeight:700,fontSize:12}}>{fmt(at.valor_final||at.valor)}</span><Badge text={at.pago?"Pago":"Pendente"} color={at.pago?C.success:C.warn}/></div>
            </div>
          );})}
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
  const calcCustos=(f)=>{const ci=insumos.reduce((s,i)=>s+(Number(i.custo_total)||0),0);const pv=Number(f.preco_venda)||0;const cf=Number(f.custo_fixo)||0;const ct=ci+cf;const mg=pv>0?Math.round((pv-ct)/pv*100):0;return{custo_insumos:ci,custo_total:ct,margem:mg};};

  const abrir=(item)=>{
    if(item){setEditing(item);setForm(item);const ins=(data.procedimento_insumos||[]).filter(i=>i.procedimento_id===item.id).map(i=>{const prod=data.produtos.find(p=>p.id===i.produto_id);return{...i,produto_nome:prod?.nome||""};});setInsumos(ins);}
    else{setEditing(null);setForm(init);setInsumos([]);}
    setModal(true);
  };

  const addInsumo=()=>setInsumos(l=>[...l,{produto_id:"",produto_nome:"",quantidade:1,custo_unitario:0,custo_total:0}]);
  const updInsumo=(idx,k,v)=>setInsumos(l=>l.map((item,i)=>{if(i!==idx)return item;const updated={...item,[k]:v};if(k==="produto_id"){const prod=data.produtos.find(p=>p.id===parseInt(v));if(prod){updated.custo_unitario=prod.custo_unitario;updated.produto_nome=prod.nome;updated.custo_total=(Number(updated.quantidade)||1)*prod.custo_unitario;}}if(k==="quantidade"||k==="custo_unitario"){updated.custo_total=(Number(updated.quantidade)||0)*(Number(updated.custo_unitario)||0);}return updated;}));
  const rmInsumo=(idx)=>setInsumos(l=>l.filter((_,i)=>i!==idx));

  const calcSimulador=()=>{const tf=data.despesas_fixas.reduce((s,d)=>s+(Number(d.valor)||0),0);const horasMes=(Number(sim.dias_uteis)||22)*(Number(sim.horas_dia)||8);const custoHora=horasMes>0?tf/horasMes:0;const duracaoH=(Number(sim.duracao)||60)/60;const custoFixo=custoHora*duracaoH;setForm(p=>({...p,custo_fixo:custoFixo.toFixed(2),duracao_minutos:Number(sim.duracao)}));setSimModal(false);};

  const salvar=async()=>{
    const custos=calcCustos(form);const rec={...form,...custos,preco_venda:Number(form.preco_venda),markup:Number(form.markup),custo_fixo:Number(form.custo_fixo),duracao_minutos:Number(form.duracao_minutos)};
    let procId;
    if(editing){await update("procedimentos",editing.id,rec);procId=editing.id;}
    else{const novo=await insert("procedimentos",rec);procId=novo?.id||Date.now();}
    // Salvar insumos
    for(const ins of insumos){
      if(!ins.produto_id)continue;
      const insRec={procedimento_id:procId,produto_id:parseInt(ins.produto_id),quantidade:Number(ins.quantidade),custo_unitario:Number(ins.custo_unitario),custo_total:Number(ins.custo_total)};
      if(ins.id&&!String(ins.id).startsWith("new")){await update("procedimento_insumos",ins.id,insRec);}
      else{await insert("procedimento_insumos",insRec);}
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
          <div style={{color:C.accent,fontSize:11,fontWeight:700,marginBottom:6}}>Despesas fixas mensais: {fmt(data.despesas_fixas.reduce((s,d)=>s+(Number(d.valor)||0),0))}</div>
          <div style={{color:C.muted,fontSize:11}}>O simulador calcula o custo das despesas fixas proporcionais ao tempo do procedimento.</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
          <Inp label="Dias úteis/mês" type="number" value={sim.dias_uteis} onChange={e=>setSim(s=>({...s,dias_uteis:e.target.value}))}/>
          <Inp label="Horas/dia" type="number" value={sim.horas_dia} onChange={e=>setSim(s=>({...s,horas_dia:e.target.value}))}/>
          <Inp label="Duração (min)" type="number" value={sim.duracao} onChange={e=>setSim(s=>({...s,duracao:e.target.value}))}/>
        </div>
        {(()=>{const tf=data.despesas_fixas.reduce((s,d)=>s+(Number(d.valor)||0),0);const hm=(Number(sim.dias_uteis)||22)*(Number(sim.horas_dia)||8);const ch=hm>0?tf/hm:0;const cf=ch*(Number(sim.duracao)||60)/60;return(
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


/* ─── FINANCEIRO ─────────────────────────────────────────────── */
function Financeiro({data,insert,update}) {
  const [aba,setAba]=useState("receber");
  const [modal,setModal]=useState(null);
  const [baixaModal,setBaixaModal]=useState(null);
  const [baixaConta,setBaixaConta]=useState("");
  const [filtR,setFiltR]=useState({paciente:"",de:"",ate:"",status:""});
  const [filtP,setFiltP]=useState({fornecedor:"",de:"",ate:"",status:""});
  const [filtM,setFiltM]=useState({conta:"",de:"",ate:""});
  const [form,setForm]=useState({descricao:"",valor:0,vencimento:today(),categoria:"",fornecedor:"",paciente:"",conta_id:""});

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
  const totalReceber=cr_lista.filter(c=>c.status==="aberto").reduce((s,c)=>s+(Number(c.valor)||0),0);
  const totalPagar=cp_lista.filter(c=>c.status==="aberto").reduce((s,c)=>s+(Number(c.valor)||0),0);

  const handleBaixa=async(item,tipo)=>{
    if(!baixaConta){alert("Selecione a conta.");return;}
    const tabela=tipo==="receber"?"contas_receber":"contas_pagar";
    await update(tabela,item.id,{status:"quitado",conta_id:parseInt(baixaConta),data_baixa:today()});
    await insert("movimentacoes",{conta_id:parseInt(baixaConta),tipo:tipo==="receber"?"entrada":"saida",origem:tipo==="receber"?"contas_receber":"contas_pagar",origem_id:item.id,descricao:tipo==="receber"?`Recebimento — ${item.paciente||item.descricao}`:`Pagamento — ${item.descricao}`,valor:Number(item.valor)||0,data:today()});
    setBaixaModal(null);setBaixaConta("");
  };

  const cancelar=(id,tipo)=>{
    const tabela=tipo==="receber"?"contas_receber":"contas_pagar";
    update(tabela,id,{status:"cancelado"});
  };

  const statusColor={aberto:C.warn,quitado:C.success,cancelado:C.danger,vencido:C.danger};

  const abas=[
    {id:"receber",label:"Contas a Receber",valor:fmt(totalReceber),cor:C.success},
    {id:"pagar",label:"Contas a Pagar",valor:fmt(totalPagar),cor:C.danger},
    {id:"extrato",label:"Extrato por Conta",valor:fmt(saldos.reduce((s,c)=>s+c.saldo,0)),cor:C.info},
    {id:"fixas",label:"Despesas Fixas",valor:fmt(data.despesas_fixas.reduce((s,d)=>s+(Number(d.valor)||0),0)),cor:C.warn},
    {id:"variaveis",label:"Despesas Variáveis",valor:fmt(data.despesas_variaveis.reduce((s,d)=>s+(Number(d.valor)||0),0)),cor:C.warn},
  ];

  return(
    <div>
      <PH title="Financeiro" sub="Controle completo"/>
      <div style={{display:"flex",gap:7,marginBottom:16,flexWrap:"wrap"}}>
        {abas.map(a=><button key={a.id} onClick={()=>setAba(a.id)} style={{background:aba===a.id?C.card:C.surface,border:`1px solid ${aba===a.id?a.cor+"50":C.border}`,borderRadius:10,padding:"9px 14px",textAlign:"left",minWidth:105}}>
          <div style={{color:C.muted,fontSize:10,marginBottom:2}}>{a.label}</div>
          <div style={{color:a.cor,fontSize:13,fontWeight:700}}>{a.valor}</div>
        </button>)}
      </div>

      {/* A RECEBER */}
      {aba==="receber"&&<>
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:11}}><Btn onClick={()=>setModal("rec")}><I.Plus s={12}/> Lançar</Btn></div>
        <FilterBar filters={[{key:"paciente",type:"text",label:"Buscar paciente..."},{key:"de",type:"date",label:"De"},{key:"ate",type:"date",label:"Até"},{key:"status",type:"select",label:"Status",options:[{value:"aberto",label:"Aberto"},{value:"quitado",label:"Quitado"},{value:"cancelado",label:"Cancelado"}]}]} values={filtR} onChange={(k,v)=>setFiltR(p=>({...p,[k]:v}))}/>
        <ST cols={["Paciente","Descrição","Vencimento","Valor","Forma Pgto","Status","Ações"]}
          rows={cr_lista.map(c=>[
            <span style={{fontWeight:600}}>{c.paciente||"—"}</span>,
            <span style={{fontSize:11}}>{c.descricao}</span>,
            <span style={{fontSize:11,color:c.status==="aberto"&&c.vencimento<today()?C.danger:C.text}}>{fmtDate(c.vencimento)}</span>,
            <span style={{color:C.success,fontWeight:700}}>{fmt(c.valor)}</span>,
            <span style={{color:C.muted,fontSize:11}}>{c.forma_pagamento||"—"}</span>,
            <Badge text={c.status} color={statusColor[c.status]||C.muted}/>,
            <div style={{display:"flex",gap:4}}>
              {c.status==="aberto"&&<Btn v="ok" onClick={()=>{setBaixaModal({...c,_tipo:"receber"});}} style={{padding:"3px 8px",fontSize:10}}>Baixar</Btn>}
              {c.status==="aberto"&&<Btn v="d" onClick={()=>cancelar(c.id,"receber")} style={{padding:"3px 7px"}}><I.X s={11}/></Btn>}
            </div>
          ])}
        />
      </>}

      {/* A PAGAR */}
      {aba==="pagar"&&<>
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:11}}><Btn onClick={()=>setModal("pag")}><I.Plus s={12}/> Lançar</Btn></div>
        <FilterBar filters={[{key:"fornecedor",type:"text",label:"Buscar fornecedor/descrição..."},{key:"de",type:"date",label:"De"},{key:"ate",type:"date",label:"Até"},{key:"status",type:"select",label:"Status",options:[{value:"aberto",label:"Aberto"},{value:"quitado",label:"Quitado"},{value:"cancelado",label:"Cancelado"}]}]} values={filtP} onChange={(k,v)=>setFiltP(p=>({...p,[k]:v}))}/>
        <ST cols={["Fornecedor","Descrição","Categoria","Vencimento","Valor","Status","Ações"]}
          rows={cp_lista.map(c=>[
            <span style={{fontWeight:600}}>{c.fornecedor||"—"}</span>,
            <span style={{fontSize:11}}>{c.descricao}</span>,
            <span style={{color:C.muted,fontSize:11}}>{c.categoria||"—"}</span>,
            <span style={{fontSize:11,color:c.status==="aberto"&&c.vencimento<today()?C.danger:C.text}}>{fmtDate(c.vencimento)}</span>,
            <span style={{color:C.danger,fontWeight:700}}>{fmt(c.valor)}</span>,
            <Badge text={c.status} color={statusColor[c.status]||C.muted}/>,
            <div style={{display:"flex",gap:4}}>
              {c.status==="aberto"&&<Btn v="ok" onClick={()=>{setBaixaModal({...c,_tipo:"pagar"});}} style={{padding:"3px 8px",fontSize:10}}>Baixar</Btn>}
              {c.status==="aberto"&&<Btn v="d" onClick={()=>cancelar(c.id,"pagar")} style={{padding:"3px 7px"}}><I.X s={11}/></Btn>}
            </div>
          ])}
        />
      </>}

      {/* EXTRATO */}
      {aba==="extrato"&&<>
        <div className="stat-row" style={{display:"flex",gap:9,marginBottom:13,flexWrap:"wrap"}}>
          {saldos.map(c=><SC key={c.id} label={c.nome} value={fmt(c.saldo)} Icon={c.tipo==="caixa"?I.Dollar:I.Bank} color={c.saldo>=0?C.success:C.danger} sub={c.tipo==="caixa"?"Caixa":"Conta Corrente"}/>)}
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

      {/* FIXAS */}
      {aba==="fixas"&&<>
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:11}}><Btn onClick={()=>setModal("fixa")}><I.Plus s={12}/> Adicionar</Btn></div>
        <ST cols={["Despesa","Categoria","Valor Mensal","Ações"]}
          rows={data.despesas_fixas.map(d=>[
            <span style={{fontWeight:600}}>{d.nome}</span>,<span style={{color:C.muted,fontSize:11}}>{d.categoria||"—"}</span>,
            <span style={{color:C.danger,fontWeight:700}}>{fmt(d.valor)}</span>,
            <Btn v="d" onClick={()=>update("despesas_fixas",d.id,{ativo:false})} style={{padding:"3px 7px"}}><I.X s={11}/></Btn>
          ])}
        />
      </>}

      {/* VARIÁVEIS */}
      {aba==="variaveis"&&<>
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:11}}><Btn onClick={()=>setModal("var")}><I.Plus s={12}/> Lançar</Btn></div>
        <ST cols={["Despesa","Categoria","Data","Valor","Ações"]}
          rows={data.despesas_variaveis.map(d=>[
            <span style={{fontWeight:600}}>{d.nome}</span>,<span style={{color:C.muted,fontSize:11}}>{d.categoria||"—"}</span>,
            fmtDate(d.data),<span style={{color:C.warn,fontWeight:700}}>{fmt(d.valor)}</span>,
            <Btn v="d" onClick={()=>update("despesas_variaveis",d.id,{ativo:false})} style={{padding:"3px 7px"}}><I.X s={11}/></Btn>
          ])}
        />
      </>}

      {/* MODAL LANÇAMENTO */}
      {modal&&<Mod title={modal==="rec"?"Nova Conta a Receber":modal==="pag"?"Nova Conta a Pagar":modal==="fixa"?"Nova Despesa Fixa":"Nova Despesa Variável"} onClose={()=>setModal(null)}>
        <Inp label="Descrição" value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))}/>
        <Inp label="Valor (R$)" type="number" value={form.valor} onChange={e=>setForm(f=>({...f,valor:e.target.value}))}/>
        {modal==="pag"&&<Inp label="Fornecedor" value={form.fornecedor} onChange={e=>setForm(f=>({...f,fornecedor:e.target.value}))}/>}
        {modal==="rec"&&<Inp label="Paciente" value={form.paciente} onChange={e=>setForm(f=>({...f,paciente:e.target.value}))}/>}
        {(modal==="fixa"||modal==="pag"||modal==="var")&&<Inp label="Categoria" value={form.categoria} onChange={e=>setForm(f=>({...f,categoria:e.target.value}))} placeholder="Imóvel, Insumos, Marketing..."/>}
        {(modal==="rec"||modal==="pag")&&<Inp label="Vencimento" type="date" value={form.vencimento} onChange={e=>setForm(f=>({...f,vencimento:e.target.value}))}/>}
        {modal==="var"&&<Inp label="Data" type="date" value={form.vencimento} onChange={e=>setForm(f=>({...f,vencimento:e.target.value}))}/>}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Btn v="g" onClick={()=>setModal(null)}>Cancelar</Btn>
          <Btn onClick={async()=>{const v=Number(form.valor);if(modal==="fixa")await insert("despesas_fixas",{nome:form.descricao,valor:v,categoria:form.categoria});if(modal==="var")await insert("despesas_variaveis",{nome:form.descricao,valor:v,categoria:form.categoria,data:form.vencimento||today()});if(modal==="rec")await insert("contas_receber",{descricao:form.descricao,paciente:form.paciente,valor:v,vencimento:form.vencimento,status:"aberto"});if(modal==="pag")await insert("contas_pagar",{descricao:form.descricao,fornecedor:form.fornecedor,categoria:form.categoria,valor:v,vencimento:form.vencimento,status:"aberto"});setModal(null);}}><I.Check s={12}/> Salvar</Btn>
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
    </div>
  );
}


/* ─── CUSTOS & PRECIFICAÇÃO ──────────────────────────────────── */
function Precos({data, update}) {
  const [filt, setFilt] = useState({busca:"", tipo:""});
  const [editMode, setEditMode] = useState(false);
  const [editValues, setEditValues] = useState({});
  const ff = (k,v) => setFilt(p=>({...p,[k]:v}));

  const tf = data.despesas_fixas.reduce((s,d)=>s+(Number(d.valor)||0),0);
  const tv = data.despesas_variaveis.reduce((s,d)=>s+(Number(d.valor)||0),0);
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
  const tf = data.despesas_fixas.reduce((s,d)=>s+(Number(d.valor)||0),0);
  const tv = data.despesas_variaveis.reduce((s,d)=>s+(Number(d.valor)||0),0);
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
  const exportExcel = (tipo) => {
    let csv="";
    if(tipo==="financeiro"){
      csv="Métrica;Valor\n";
      csv+=`Receita;${fmt(rec)}\nDespesas;${fmt(tf+tv)}\nLucro;${fmt(lucro)}\nMargem;${rec>0?Math.round(lucro/rec*100):0}%\nTicket Médio;${fmt(ticket)}\nAtendimentos;${atsFilt.length}\nTaxa Conversão;${txConversao}%\n`;
    }
    if(tipo==="crm"){
      csv="Nome;CPF;WhatsApp;Email;Total Gasto;Visitas;Última Visita;Dias Sem Vir;Segmento\n";
      crmPacientes.forEach(p=>{csv+=`${p.nome};${p.cpf||""};${p.whatsapp||p.telefone||""};${p.email||""};${fmt(p.total_real)};${p.freq};${fmtDate(p.ultima_visita_real)};${p.dias_sem_vir===999?"—":p.dias_sem_vir};${p.segmento}\n`;});
    }
    if(tipo==="procedimentos"){
      csv="Procedimento;Realizados;Receita\n";
      porProc.forEach(p=>{csv+=`${p.nome};${p.realizados};${fmt(p.receita)}\n`;});
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
            {[["Despesas Fixas",tf,C.danger],["Despesas Variáveis",tv,C.warn],["Lucro Líquido",Math.max(0,lucro),C.success]].map(([label,val,cor])=>(
              <div key={label} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{color:C.text,fontSize:12}}>{label}</span>
                  <span style={{color:cor,fontWeight:700,fontSize:12}}>{fmt(val)} ({rec>0?Math.round(val/rec*100):0}%)</span>
                </div>
                <div style={{background:C.surface,borderRadius:20,height:5}}>
                  <div style={{width:`${rec>0?Math.min(val/rec*100,100):0}%`,height:"100%",background:cor,borderRadius:20}}/>
                </div>
              </div>
            ))}
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
            {msgEnviando?<><Spin c="#0A0A0F" s={12}/>Enviando...</>:<><I.Send s={12}/> Enviar Campanha</>}
          </Btn>
        </div>
      </Mod>}
    </div>
  );
}


/* ─── CADASTROS AUXILIARES ───────────────────────────────────── */
function Cadastros({data,insert,update,remove}) {
  const [aba,setAba] = useState("fp");
  const [modal,setModal] = useState(false);
  const [editing,setEditing] = useState(null);
  const [form,setForm] = useState({});
  const fv = (k,v) => setForm(p=>({...p,[k]:v}));

  // Usuários
  const [usuarios,setUsuarios] = useState([]);
  const [novoUser,setNovoUser] = useState({email:"",password:"",nome:"",role:"profissional"});
  const [msgUser,setMsgUser] = useState("");

  const carregarUsuarios = async () => {
    if(DEMO_MODE){
      setUsuarios([
        {id:"demo-1",email:"demo@clinica.com",user_metadata:{nome:"Demo Admin",role:"admin"},created_at:new Date().toISOString()},
        {id:"demo-2",email:"profissional@clinica.com",user_metadata:{nome:"Profissional Demo",role:"profissional"},created_at:new Date().toISOString()},
      ]);
      return;
    }
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`,{headers:{...sb.h}});
      const d = await r.json();
      setUsuarios(d.users||[]);
    } catch(e){ console.error(e); }
  };

  useEffect(()=>{ if(aba==="usuarios") carregarUsuarios(); },[aba]);

  const criarUsuario = async () => {
    if(!novoUser.email||!novoUser.password){ setMsgUser("Preencha e-mail e senha."); return; }
    if(DEMO_MODE){ setMsgUser("✓ Usuário criado (modo demo)."); return; }
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`,{
        method:"POST", headers:{...sb.h},
        body:JSON.stringify({email:novoUser.email,password:novoUser.password,email_confirm:true,user_metadata:{nome:novoUser.nome,role:novoUser.role}})
      });
      const d = await r.json();
      if(d.error){ setMsgUser(`Erro: ${d.message}`); return; }
      setMsgUser("✓ Usuário criado com sucesso!");
      setNovoUser({email:"",password:"",nome:"",role:"profissional"});
      carregarUsuarios();
    } catch(e){ setMsgUser("Erro de conexão."); }
  };

  const excluirUsuario = async (id) => {
    if(!window.confirm("Excluir este usuário?")) return;
    if(DEMO_MODE){ setUsuarios(u=>u.filter(u=>u.id!==id)); return; }
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`,{method:"DELETE",headers:{...sb.h}});
      carregarUsuarios();
    } catch(e){ console.error(e); }
  };

  const salvar = async () => {
    const tableMap = {fp:"formas_pagamento",cb:"contas_bancarias",prof:"profissionais"};
    const table = tableMap[aba];
    if(!table) return;
    if(editing){ await update(table,editing.id,form); }
    else { await insert(table,form); }
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
        {[["fp","Formas de Pagamento"],["cb","Contas e Caixa"],["prof","Profissionais"],["usuarios","Usuários"]].map(a=>(
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
            <Sel label="Tipo" value={form.tipo||"caixa"} onChange={e=>fv("tipo",e.target.value)} options={[{value:"caixa",label:"Caixa Físico"},{value:"conta_corrente",label:"Conta Corrente"},{value:"conta_poupanca",label:"Poupança"},{value:"carteira_digital",label:"Carteira Digital"}]}/>
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

      {/* CONTAS A PAGAR */}
      {aba==="cp"&&<>
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:11}}>
          <Btn onClick={()=>abrirModal(null,{descricao:"",fornecedor:"",categoria:"",valor:0,vencimento:today(),status:"aberto"})}><I.Plus s={12}/> Lançar</Btn>
        </div>
        <ST cols={["Descrição","Fornecedor","Categoria","Vencimento","Valor","Status","Ações"]}
          rows={(data.contas_pagar||[]).map(cp=>[
            <span style={{fontWeight:600,fontSize:12}}>{cp.descricao}</span>,
            <span style={{color:C.muted,fontSize:11}}>{cp.fornecedor||"—"}</span>,
            <span style={{color:C.muted,fontSize:11}}>{cp.categoria||"—"}</span>,
            <span style={{fontSize:11,color:cp.status==="aberto"&&cp.vencimento<today()?C.danger:C.text}}>{fmtDate(cp.vencimento)}</span>,
            <span style={{color:C.danger,fontWeight:700}}>{fmt(cp.valor)}</span>,
            <Badge text={cp.status} color={cp.status==="quitado"?C.success:cp.status==="cancelado"?C.muted:C.warn}/>,
            <div style={{display:"flex",gap:4}}>
              {cp.status==="aberto"&&<Btn v="ok" onClick={()=>update("contas_pagar",cp.id,{status:"quitado",data_baixa:today()})} style={{padding:"3px 8px",fontSize:10}}>Quitar</Btn>}
              {cp.status==="aberto"&&<Btn v="d" onClick={()=>update("contas_pagar",cp.id,{status:"cancelado"})} style={{padding:"3px 7px"}}><I.X s={11}/></Btn>}
              <Btn v="g" onClick={()=>abrirModal(cp,{})} style={{padding:"3px 7px"}}><I.Edit s={11}/></Btn>
            </div>
          ])}
        />
        {modal&&<Mod title={editing?"Editar Conta a Pagar":"Nova Conta a Pagar"} onClose={()=>{setModal(false);setEditing(null);}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Inp label="Descrição" value={form.descricao||""} onChange={e=>fv("descricao",e.target.value)} style={{gridColumn:"1/-1"}}/>
            <Inp label="Fornecedor" value={form.fornecedor||""} onChange={e=>fv("fornecedor",e.target.value)}/>
            <Inp label="Categoria" value={form.categoria||""} onChange={e=>fv("categoria",e.target.value)} placeholder="Imóvel, Insumos..."/>
            <Inp label="Valor (R$)" type="number" value={form.valor||0} onChange={e=>fv("valor",e.target.value)}/>
            <Inp label="Vencimento" type="date" value={form.vencimento||today()} onChange={e=>fv("vencimento",e.target.value)}/>
            <Sel label="Status" value={form.status||"aberto"} onChange={e=>fv("status",e.target.value)} options={[{value:"aberto",label:"Aberto"},{value:"quitado",label:"Quitado"},{value:"cancelado",label:"Cancelado"}]}/>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:10}}>
            <Btn v="g" onClick={()=>{setModal(false);setEditing(null);}}>Cancelar</Btn>
            <Btn onClick={salvar}><I.Check s={12}/> Salvar</Btn>
          </div>
        </Mod>}
      </>}

      {/* PROFISSIONAIS */}
      {aba==="prof"&&<>
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:11}}>
          <Btn onClick={()=>abrirModal(null,{nome:"",especialidade:"",tipo:"percentual",percentual:40,salario:0,cor:"#C9A96E",email:"",telefone:"",ativo:true})}><I.Plus s={12}/> Adicionar</Btn>
        </div>
        <ST cols={["Nome","Especialidade","Remuneração","Cor","Status","Ações"]}
          rows={data.profissionais.map(p=>[
            <span style={{fontWeight:600}}>{p.nome}</span>,
            <span style={{color:C.muted,fontSize:11}}>{p.especialidade||"—"}</span>,
            <span style={{fontSize:11}}>{p.tipo==="percentual"?`${p.percentual}% comissão`:`Fixo ${fmt(p.salario)}`}</span>,
            <div style={{width:18,height:18,borderRadius:"50%",background:p.cor||C.accent}}/>,
            <Badge text={p.ativo?"Ativo":"Inativo"} color={p.ativo?C.success:C.muted}/>,
            <Btn v="g" onClick={()=>abrirModal(p,{})} style={{padding:"3px 7px"}}><I.Edit s={11}/></Btn>
          ])}
        />
        {modal&&<Mod title={editing?"Editar Profissional":"Novo Profissional"} onClose={()=>{setModal(false);setEditing(null);}}>
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
            <Sel label="Perfil" value={novoUser.role} onChange={e=>setNovoUser(u=>({...u,role:e.target.value}))} options={[{value:"admin",label:"Administrador"},{value:"profissional",label:"Profissional"},{value:"recepcao",label:"Recepção"}]}/>
            <Inp label="E-mail" type="email" value={novoUser.email} onChange={e=>setNovoUser(u=>({...u,email:e.target.value}))} placeholder="usuario@clinica.com"/>
            <Inp label="Senha inicial" type="password" value={novoUser.password} onChange={e=>setNovoUser(u=>({...u,password:e.target.value}))} placeholder="Mín. 6 caracteres"/>
          </div>
          {msgUser&&<div style={{background:msgUser.startsWith("✓")?C.success+"14":C.danger+"14",border:`1px solid ${msgUser.startsWith("✓")?C.success:C.danger}30`,borderRadius:8,padding:"8px 12px",marginTop:9,color:msgUser.startsWith("✓")?C.success:C.danger,fontSize:12}}>{msgUser}</div>}
          <div style={{display:"flex",justifyContent:"flex-end",marginTop:12}}>
            <Btn onClick={criarUsuario} disabled={!novoUser.email||!novoUser.password}><I.Plus s={12}/> Criar Usuário</Btn>
          </div>
          <div style={{marginTop:11,background:C.warn+"10",border:`1px solid ${C.warn}25`,borderRadius:8,padding:"9px 12px"}}>
            <span style={{color:C.warn,fontSize:11}}>⚙ Para gerenciamento avançado acesse <strong>Supabase → Authentication → Users</strong></span>
          </div>
        </div>
        <h3 style={{color:C.text,fontSize:13,fontWeight:700,marginBottom:10}}>Usuários cadastrados</h3>
        <ST cols={["Nome","E-mail","Perfil","Criado em","Ação"]}
          rows={usuarios.map(u=>[
            <span style={{fontWeight:600,fontSize:12}}>{u.user_metadata?.nome||"—"}</span>,
            <span style={{color:C.muted,fontSize:11}}>{u.email}</span>,
            <Badge text={u.user_metadata?.role||"profissional"} color={u.user_metadata?.role==="admin"?C.accent:C.info}/>,
            <span style={{fontSize:11,color:C.muted}}>{u.created_at?new Date(u.created_at).toLocaleDateString("pt-BR"):"—"}</span>,
            <Btn v="d" onClick={()=>excluirUsuario(u.id)} style={{padding:"3px 8px",fontSize:10}}><I.X s={11}/> Excluir</Btn>
          ])}
        />
      </div>}
    </div>
  );
}

/* ─── CHAT IA ────────────────────────────────────────────────── */
function ChatIA({data}) {
  const [msgs,setMsgs]=useState([{role:"assistant",text:"Olá! Sou o assistente IA do EstéticaPro. Tenho acesso aos dados reais da sua clínica — receita, pacientes, estoque e procedimentos. Como posso ajudar?"}]);
  const [input,setInput]=useState("");const [loading,setLoading]=useState(false);const endRef=useRef(null);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);
  const sug=["Análise financeira do mês","Quais serviços são mais rentáveis?","Pacientes em risco de churn?","Como aumentar o ticket médio?","Estoque crítico?","Profissional mais produtivo?"];
  const enviar=async()=>{
    if(!input.trim()||loading)return;
    const msg=input.trim();setInput("");setLoading(true);
    setMsgs(m=>[...m,{role:"user",text:msg}]);
    const rec=data.atendimentos.reduce((s,a)=>s+(Number(a.valor_final||a.valor)||0),0);
    const desp=[...data.despesas_fixas,...data.despesas_variaveis].reduce((s,d)=>s+(Number(d.valor)||0),0);
    const critico=data.produtos.filter(p=>p.estoque_atual<=p.estoque_minimo).map(p=>p.nome);
    const vips=data.pacientes.filter(p=>(p.total_gasto||0)>3000);
    const ctx=`Você é a IA de gestão da clínica de estética avançada "${data?.clinica||"EstéticaPro"}". 
Dados atuais:
- Profissionais: ${data.profissionais.map(p=>`${p.nome} (${p.especialidade})`).join("; ")}
- Procedimentos: ${data.procedimentos.map(p=>`${p.nome} R$${p.preco_venda} margem ${p.margem}%`).join("; ")}
- Receita total: R$${rec.toFixed(2)} | Despesas: R$${desp.toFixed(2)} | Lucro: R$${(rec-desp).toFixed(2)}
- Atendimentos: ${data.atendimentos.length} | Pacientes: ${data.pacientes.length} | VIPs: ${vips.length}
- Estoque crítico: ${critico.length>0?critico.join(", "):"nenhum"}
- Agendamentos hoje: ${data.agendamentos.filter(a=>a.data===today()).length}
Responda em português, seja analítico e objetivo. Máx 4 frases. Use dados concretos quando possível.`;
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:ctx,messages:[...msgs.filter((_,i)=>i>0).map(m=>({role:m.role,content:m.text})),{role:"user",content:msg}]})});
      const json=await res.json();
      setMsgs(m=>[...m,{role:"assistant",text:json.content?.[0]?.text||"Não consegui processar."}]);
    }catch{setMsgs(m=>[...m,{role:"assistant",text:"Erro de conexão com a IA."}]);}
    setLoading(false);
  };
  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 120px)"}}>
      <PH title="Assistente IA" sub="Conectado aos dados reais da clínica"/>
      <div style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:13,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{flex:1,overflowY:"auto",padding:13}}>
          {msgs.map((m,i)=>(
            <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",marginBottom:10,gap:7,alignItems:"flex-end"}}>
              {m.role==="assistant"&&<div style={{width:26,height:26,borderRadius:"50%",background:C.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><I.Sparkle c={C.accent} s={12}/></div>}
              <div style={{maxWidth:"75%",background:m.role==="user"?C.accent:C.surface,color:m.role==="user"?"#0A0A0F":C.text,padding:"9px 13px",borderRadius:m.role==="user"?"12px 12px 4px 12px":"12px 12px 12px 4px",fontSize:12,lineHeight:1.6}}>{m.text}</div>
            </div>
          ))}
          {loading&&<div style={{display:"flex",gap:7,alignItems:"flex-end"}}><div style={{width:26,height:26,borderRadius:"50%",background:C.accentSoft,display:"flex",alignItems:"center",justifyContent:"center"}}><I.Sparkle c={C.accent} s={12}/></div><div style={{background:C.surface,padding:"9px 13px",borderRadius:"12px 12px 12px 4px",color:C.muted,fontSize:12,display:"flex",gap:5,alignItems:"center"}}><Spin c={C.muted} s={12}/>Analisando dados...</div></div>}
          <div ref={endRef}/>
        </div>
        {msgs.length===1&&<div style={{padding:"0 12px 10px",display:"flex",gap:5,flexWrap:"wrap"}}>{sug.map(s=><button key={s} onClick={()=>setInput(s)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,padding:"4px 10px",color:C.muted,fontSize:10,cursor:"pointer"}}>{s}</button>)}</div>}
        <div style={{padding:"9px 11px",borderTop:`1px solid ${C.border}`,display:"flex",gap:7}}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&enviar()} placeholder="Pergunte sobre sua clínica..." style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 12px",color:C.text,fontSize:13}}/>
          <button onClick={enviar} disabled={loading||!input.trim()} style={{background:C.accent,border:"none",borderRadius:9,padding:"9px 12px",cursor:"pointer",opacity:loading||!input.trim()?0.5:1}}><I.Send c="#0A0A0F" s={14}/></button>
        </div>
      </div>
    </div>
  );
}


/* ─── LANDING PAGE ───────────────────────────────────────────── */
function Landing({onLogin,onCheckout}) {
  const [scrolled,setScrolled]=useState(false);const [menuOpen,setMenuOpen]=useState(false);const [activeQ,setActiveQ]=useState(null);
  useEffect(()=>{const fn=()=>setScrolled(window.scrollY>50);window.addEventListener("scroll",fn);return()=>window.removeEventListener("scroll",fn);},[]);
  const go=id=>{document.getElementById(id)?.scrollIntoView({behavior:"smooth"});setMenuOpen(false);};
  const feats=[
    {Icon:I.Diamond,t:"IA Integrada",d:"Assistente com acesso aos dados reais: agenda, finanças e estoque."},
    {Icon:I.Bar,t:"Formação de Preço",d:"Rateia aluguel e despesas por atendimento. Sabe exatamente quanto lucra."},
    {Icon:I.Cal,t:"Agenda Completa",d:"Confirmação, cancelamento e conversão para atendimento em 1 clique."},
    {Icon:I.User,t:"Ficha + Anamnese",d:"Histórico completo, CPF, anamnese com assinatura digital do cliente."},
    {Icon:I.Box,t:"Estoque Avançado",d:"Extrato de movimentações, entradas de compra, alertas automáticos."},
    {Icon:I.Megaphone,t:"CRM & Marketing",d:"Segmentação de clientes, campanhas WhatsApp e e-mail marketing."},
  ];
  const depos=[
    {nome:"Camila Andrade",clinica:"Studio Éclat — SP",txt:"Descobri que 2 procedimentos que mais vendia eram os menos lucrativos. Reajustei e aumentei o lucro em 34%."},
    {nome:"Fernanda Mello",clinica:"Lumina Estética — RJ",txt:"O CRM me mostrou 12 clientes que não vinham há 90 dias. Mandei WhatsApp e recuperei 7. Incrível!"},
    {nome:"Renata Silveira",clinica:"Atelier Renata — BH",txt:"A anamnese com assinatura digital me deu segurança jurídica. Profissional demais."},
  ];
  const faq=[
    {q:"Posso testar antes de assinar?",r:"Ao assinar você tem acesso completo imediato com suporte nos primeiros 7 dias."},
    {q:"O que acontece se eu cancelar?",r:"Cancele quando quiser. Dados disponíveis por 30 dias para exportação."},
    {q:"Quantos usuários posso ter?",r:"Cada assinatura inclui até 5 usuários — recepcionista, profissionais e gestora."},
    {q:"Funciona no celular?",r:"100% responsivo. Barra de navegação mobile nativa. Funciona no iPhone e Android sem instalar nada."},
    {q:"A IA é conectada aos meus dados?",r:"Sim. O assistente tem acesso em tempo real à agenda, finanças, estoque e perfil dos pacientes."},
    {q:"O envio de WhatsApp é automático?",r:"Sim, com integração Z-API (opcional). Você pode usar a interface de campanhas para envios manuais ou automatizados."},
  ];
  const GTag2=({children})=><span style={{display:"inline-flex",alignItems:"center",gap:6,background:"#C8A96A14",border:"1px solid #C8A96A35",borderRadius:40,padding:"5px 14px",color:"#C8A96A",fontSize:11,fontWeight:600,letterSpacing:1.4,textTransform:"uppercase"}}>{children}</span>;
  return(
    <div style={{background:T.bg,minHeight:"100vh",fontFamily:"'DM Sans',sans-serif"}}>
      {/* NAV */}
      <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:500,background:scrolled?`${T.bg}F0`:"transparent",borderBottom:scrolled?`1px solid ${T.border}`:"1px solid transparent",backdropFilter:scrolled?"blur(18px)":"none",padding:"0 clamp(16px,5vw,52px)"}}>
        <div style={{maxWidth:1040,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center",height:58}}>
          <div className="cm" style={{fontSize:19,fontWeight:600,color:T.text}}>Estética<span style={{color:T.gold}}>Pro</span></div>
          <div className="hs" style={{display:"flex",gap:24,alignItems:"center"}}>
            {[["dores","Problema"],["feats","Solução"],["precos","Preços"],["faq","FAQ"]].map(([id,l])=>(
              <button key={id} className="nl" onClick={()=>go(id)} style={{background:"none",border:"none",color:T.mutedLt,fontSize:12,fontWeight:500,cursor:"pointer"}}>{l}</button>
            ))}
          </div>
          <div style={{display:"flex",gap:7,alignItems:"center"}}>
            <button onClick={onLogin} style={{background:"transparent",border:`1px solid ${T.border}`,borderRadius:8,padding:"7px 14px",color:T.mutedLt,fontSize:12,fontWeight:500,cursor:"pointer"}}>Entrar</button>
            <button className="gb hs" onClick={()=>onCheckout("anual")} style={{background:T.gold,color:T.bg,border:"none",borderRadius:8,padding:"7px 16px",fontWeight:700,fontSize:12,cursor:"pointer"}}>Assinar agora</button>
            <button onClick={()=>setMenuOpen(!menuOpen)} style={{background:"none",border:"none",color:T.mutedLt,padding:3,cursor:"pointer"}}>{menuOpen?<I.X c={T.mutedLt} s={19}/>:<I.Menu c={T.mutedLt} s={19}/>}</button>
          </div>
        </div>
        {menuOpen&&<div style={{background:T.surface,borderTop:`1px solid ${T.border}`,padding:"12px 18px"}}>
          {[["O Problema","dores"],["A Solução","feats"],["Planos","precos"],["FAQ","faq"]].map(([l,id])=>(
            <button key={id} onClick={()=>go(id)} style={{display:"block",background:"none",border:"none",color:T.text,fontSize:14,padding:"9px 0",textAlign:"left",width:"100%",borderBottom:`1px solid ${T.border}`,cursor:"pointer"}}>{l}</button>
          ))}
          <div style={{display:"flex",gap:7,marginTop:10}}>
            <button onClick={()=>{onLogin();setMenuOpen(false);}} style={{flex:1,background:"transparent",border:`1px solid ${T.border}`,borderRadius:8,padding:"10px",color:T.mutedLt,fontSize:13,cursor:"pointer"}}>Entrar</button>
            <button className="gb" onClick={()=>{onCheckout("anual");setMenuOpen(false);}} style={{flex:1,background:T.gold,color:T.bg,border:"none",borderRadius:8,padding:"10px",fontWeight:700,fontSize:13,cursor:"pointer"}}>Assinar →</button>
          </div>
        </div>}
      </nav>
      {/* HERO */}
      <section style={{minHeight:"100vh",display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",padding:"100px clamp(16px,6vw,52px) 60px",textAlign:"center",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:"10%",left:"6%",width:320,height:320,borderRadius:"50%",background:`radial-gradient(circle,${T.gold}08,transparent 70%)`,pointerEvents:"none"}}/>
        <div className="fu d1"><GTag2><I.Sparkle c={T.gold} s={10}/> Sistema exclusivo para estética avançada</GTag2></div>
        <h1 className="cm ht fu d2" style={{fontSize:"clamp(38px,7vw,76px)",fontWeight:300,lineHeight:1.1,color:T.text,margin:"22px 0 15px",maxWidth:780}}>Sua clínica merece uma<br/><span style={{fontStyle:"italic",color:T.gold}}>gestão à altura</span> do seu talento</h1>
        <p className="fu d3" style={{color:T.mutedLt,fontSize:"clamp(13px,2vw,16px)",lineHeight:1.7,maxWidth:480,marginBottom:34}}>IA integrada, CRM inteligente, formação de preço e anamnese digital. Do agendamento à retenção de clientes.</p>
        <div className="fu d4 hero-btns" style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center",marginBottom:40}}>
          <button className="gb gl" onClick={()=>onCheckout("anual")} style={{background:T.gold,color:T.bg,border:"none",borderRadius:10,padding:"12px 26px",fontWeight:700,fontSize:14,display:"flex",alignItems:"center",gap:7,cursor:"pointer"}}>Começar agora <I.Arrow c={T.bg} s={14}/></button>
          <button className="ob" onClick={onLogin} style={{background:"transparent",color:T.mutedLt,border:`1px solid ${T.border}`,borderRadius:10,padding:"12px 22px",fontWeight:500,fontSize:13,cursor:"pointer"}}>Já tenho conta → Entrar</button>
        </div>
        <div className="fu d5" style={{display:"flex",gap:30,flexWrap:"wrap",justifyContent:"center"}}>
          {[["+34%","lucro médio"],["-5h","economizadas/sem."],["11","módulos integrados"],["CRM","retenção de clientes"]].map(([v,l])=>(
            <div key={l} style={{textAlign:"center"}}><div className="cm" style={{fontSize:22,fontWeight:600,color:T.gold}}>{v}</div><div style={{color:T.muted,fontSize:11,marginTop:2}}>{l}</div></div>
          ))}
        </div>
      </section>
      {/* FEATURES */}
      <section id="feats" style={{padding:"66px clamp(16px,6vw,52px)",background:T.surface,borderTop:`1px solid ${T.border}`}}>
        <div style={{maxWidth:1000,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:40}}><GTag2>A solução completa</GTag2><h2 className="cm" style={{fontSize:"clamp(20px,4vw,38px)",fontWeight:400,color:T.text,margin:"13px 0 8px",lineHeight:1.25}}>Tudo em um sistema só.<br/><span style={{fontStyle:"italic",color:T.gold}}>11 módulos integrados.</span></h2></div>
          <div className="feat-grid" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
            {feats.map((f,i)=><div key={i} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"17px 15px"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <div style={{background:`${T.gold}13`,borderRadius:7,width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><f.Icon c={T.gold} s={14}/></div>
                <h3 style={{color:T.text,fontSize:11,fontWeight:600,lineHeight:1.3}}>{f.t}</h3>
              </div>
              <p style={{color:T.muted,fontSize:10,lineHeight:1.65}}>{f.d}</p>
            </div>)}
          </div>
        </div>
      </section>
      {/* DEPOIMENTOS */}
      <section style={{padding:"60px clamp(16px,6vw,52px)",borderTop:`1px solid ${T.border}`}}>
        <div style={{maxWidth:920,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:38}}><GTag2>Resultados reais</GTag2><h2 className="cm" style={{fontSize:"clamp(18px,4vw,34px)",fontWeight:400,color:T.text,margin:"12px 0"}}>O que clínicas dizem após 30 dias</h2></div>
          <div className="g1" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:13}}>
            {depos.map((d,i)=><div key={i} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:13,padding:"18px 16px"}}>
              <div style={{display:"flex",gap:2,marginBottom:10}}>{Array(5).fill(0).map((_,j)=><I.Star key={j} c={T.gold} s={11}/>)}</div>
              <p style={{color:T.text,fontSize:11,lineHeight:1.7,fontStyle:"italic",marginBottom:13}}>"{d.txt}"</p>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:28,height:28,borderRadius:"50%",background:`${T.gold}20`,display:"flex",alignItems:"center",justifyContent:"center",color:T.gold,fontWeight:700,fontSize:11}}>{d.nome[0]}</div>
                <div><div style={{color:T.text,fontWeight:600,fontSize:11}}>{d.nome}</div><div style={{color:T.muted,fontSize:9}}>{d.clinica}</div></div>
              </div>
            </div>)}
          </div>
        </div>
      </section>
      {/* PLANOS */}
      <section id="precos" style={{padding:"66px clamp(16px,6vw,52px)",background:T.surface,borderTop:`1px solid ${T.border}`}}>
        <div style={{maxWidth:700,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:40}}><GTag2>Planos simples</GTag2><h2 className="cm" style={{fontSize:"clamp(20px,4vw,38px)",fontWeight:400,color:T.text,margin:"13px 0 7px",lineHeight:1.25}}>Uma versão. Tudo incluído.<br/><span style={{fontStyle:"italic",color:T.gold}}>Sem surpresas.</span></h2></div>
          <div className="plan-grid cs" style={{display:"flex",gap:13,alignItems:"stretch"}}>
            <div className="ph ws" style={{flex:1,background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:"24px 20px",display:"flex",flexDirection:"column"}}>
              <div style={{color:T.mutedLt,fontSize:10,textTransform:"uppercase",letterSpacing:1.4,marginBottom:7}}>Mensal</div>
              <div style={{display:"flex",alignItems:"flex-end",gap:5,marginBottom:18}}><span className="cm" style={{fontSize:44,fontWeight:600,color:T.text,lineHeight:1}}>399</span><span style={{color:T.muted,fontSize:12,marginBottom:5}}>R$/mês</span></div>
              <div style={{flex:1}}>{["5 usuários","11 módulos","IA integrada","CRM & Marketing","Suporte WhatsApp"].map(f=><div key={f} style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}><I.Check c={T.success} s={11}/><span style={{color:T.text,fontSize:11}}>{f}</span></div>)}</div>
              <button className="ob" onClick={()=>onCheckout("mensal")} style={{width:"100%",background:"transparent",color:T.gold,border:`1px solid ${T.gold}50`,borderRadius:9,padding:"10px",fontWeight:600,fontSize:12,marginTop:18,cursor:"pointer"}}>Assinar mensalmente</button>
            </div>
            <div className="ph ws" style={{flex:1,background:`linear-gradient(145deg,${T.card},#1A1810)`,border:`1.5px solid ${T.gold}50`,borderRadius:16,padding:"24px 20px",display:"flex",flexDirection:"column",position:"relative"}}>
              <div style={{position:"absolute",top:12,right:12,background:T.gold,color:T.bg,borderRadius:20,padding:"3px 10px",fontSize:8,fontWeight:800,letterSpacing:1,textTransform:"uppercase"}}>Melhor valor</div>
              <div style={{color:T.gold,fontSize:10,textTransform:"uppercase",letterSpacing:1.4,marginBottom:7}}>Anual</div>
              <div style={{display:"flex",alignItems:"flex-end",gap:5,marginBottom:4}}><span className="cm" style={{fontSize:44,fontWeight:600,color:T.goldLt,lineHeight:1}}>3.990</span><span style={{color:T.muted,fontSize:12,marginBottom:5}}>R$/ano</span></div>
              <div style={{color:T.success,fontSize:10,fontWeight:600,marginBottom:2}}>✓ 2 meses grátis — R$ 798 de economia</div>
              <div style={{color:T.muted,fontSize:9,marginBottom:18}}>=  R$ 332,50/mês</div>
              <div style={{flex:1}}>{["5 usuários","11 módulos","IA integrada","CRM & Marketing","Suporte prioritário","Relatórios exclusivos"].map(f=><div key={f} style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}><I.Check c={T.gold} s={11}/><span style={{color:T.text,fontSize:11}}>{f}</span></div>)}</div>
              <button className="gb gl" onClick={()=>onCheckout("anual")} style={{width:"100%",background:T.gold,color:T.bg,border:"none",borderRadius:9,padding:"11px",fontWeight:700,fontSize:13,marginTop:18,cursor:"pointer"}}>Assinar anualmente →</button>
            </div>
          </div>
        </div>
      </section>
      {/* FAQ */}
      <section id="faq" style={{padding:"60px clamp(16px,6vw,52px)",borderTop:`1px solid ${T.border}`}}>
        <div style={{maxWidth:600,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:36}}><GTag2>Dúvidas frequentes</GTag2><h2 className="cm" style={{fontSize:"clamp(18px,4vw,34px)",fontWeight:400,color:T.text,margin:"12px 0"}}>Perguntas e respostas</h2></div>
          {faq.map((item,i)=>(
            <div key={i} style={{borderBottom:`1px solid ${T.border}`}}>
              <button onClick={()=>setActiveQ(activeQ===i?null:i)} style={{width:"100%",background:"none",border:"none",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 0",gap:12,textAlign:"left",cursor:"pointer"}}>
                <span style={{color:T.text,fontSize:12,fontWeight:500}}>{item.q}</span>
                <div style={{flexShrink:0,transform:activeQ===i?"rotate(45deg)":"rotate(0)"}}><I.X c={T.gold} s={15}/></div>
              </button>
              {activeQ===i&&<div className="fu" style={{paddingBottom:13}}><p style={{color:T.mutedLt,fontSize:11,lineHeight:1.7}}>{item.r}</p></div>}
            </div>
          ))}
        </div>
      </section>
      {/* CTA */}
      <section style={{padding:"66px clamp(16px,6vw,52px)",textAlign:"center",background:T.surface,borderTop:`1px solid ${T.border}`}}>
        <h2 className="cm" style={{fontSize:"clamp(24px,5vw,50px)",fontWeight:300,color:T.text,lineHeight:1.2,marginBottom:13}}>Comece hoje.<br/><span style={{fontStyle:"italic",fontWeight:600,color:T.gold}}>Veja o retorno amanhã.</span></h2>
        <div className="hero-btns" style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap",marginTop:24}}>
          <button className="gb gl" onClick={()=>onCheckout("anual")} style={{background:T.gold,color:T.bg,border:"none",borderRadius:10,padding:"12px 30px",fontWeight:700,fontSize:14,cursor:"pointer"}}>Assinar — R$ 3.990/ano</button>
          <button className="ob" onClick={onLogin} style={{background:"transparent",color:T.mutedLt,border:`1px solid ${T.border}`,borderRadius:10,padding:"12px 20px",fontWeight:500,fontSize:12,cursor:"pointer"}}>Já tenho conta</button>
        </div>
        <p style={{color:T.muted,fontSize:10,marginTop:12}}>Acesso imediato · 5 usuários · Cancele quando quiser</p>
      </section>
      <footer style={{borderTop:`1px solid ${T.border}`,padding:"20px clamp(16px,5vw,52px)"}}>
        <div style={{maxWidth:1000,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
          <div className="cm" style={{fontSize:16,fontWeight:600,color:T.text}}>Estética<span style={{color:T.gold}}>Pro</span></div>
          <div style={{color:T.muted,fontSize:10}}>© 2025 EstéticaPro · Todos os direitos reservados</div>
          <div style={{display:"flex",gap:14}}>{["Privacidade","Termos","Suporte"].map(l=><span key={l} style={{color:T.muted,fontSize:10,cursor:"pointer"}}>{l}</span>)}</div>
        </div>
      </footer>
    </div>
  );
}


/* ─── SISTEMA PRINCIPAL ──────────────────────────────────────── */
function Sistema({user, onLogout}) {
  const [pag, setPag] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const { data, loading, update, insert, remove } = useData(user.id);

  const menu = [
    {id:"dashboard",   label:"Dashboard",      Icon:I.Grid},
    {id:"agendamentos",label:"Agendamentos",    Icon:I.Cal},
    {id:"atendimentos",label:"Atendimentos",    Icon:I.Receipt},
    {id:"pacientes",   label:"Pacientes",       Icon:I.User},
    {id:"fornecedores",label:"Fornecedores",    Icon:I.Truck},
    {id:"produtos",    label:"Produtos",        Icon:I.Box},
    {id:"procedimentos",label:"Procedimentos",  Icon:I.Scissors},
    {id:"estoque",     label:"Estoque",         Icon:I.ShoppingCart, alertFn:d=>d.produtos.filter(p=>p.estoque_atual<=p.estoque_minimo).length},
    {id:"financeiro",  label:"Financeiro",      Icon:I.Dollar},
    {id:"precos",      label:"Custos & Preços", Icon:I.Calculator},
    {id:"relatorios",  label:"Relatórios & CRM",Icon:I.Bar},
    {id:"cadastros",   label:"Cadastros",       Icon:I.Settings},
    {id:"ia",          label:"Assistente IA",   Icon:I.Sparkle},
  ];

  const bottomNav = [
    {id:"dashboard",   label:"Início",  Icon:I.Grid},
    {id:"agendamentos",label:"Agenda",  Icon:I.Cal},
    {id:"atendimentos",label:"Atend.",  Icon:I.Receipt},
    {id:"financeiro",  label:"Financ.", Icon:I.Dollar},
    {id:"ia",          label:"IA",      Icon:I.Sparkle},
  ];

  if(loading||!data) return(
    <div style={{display:"flex",height:"100vh",background:C.bg,alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{textAlign:"center"}}><div className="sp" style={{width:40,height:40,border:`3px solid ${C.accent}25`,borderTop:`3px solid ${C.accent}`,borderRadius:"50%",margin:"0 auto 14px"}}/><div style={{color:C.muted,fontSize:13}}>{DEMO_MODE?"Carregando dados demo...":"Conectando ao Supabase..."}</div></div>
    </div>
  );

  const p = {data, insert, update, remove};
  const render = () => {
    switch(pag) {
      case "dashboard":    return <Dashboard data={data} user={user}/>;
      case "agendamentos": return <Agendamentos {...p}/>;
      case "atendimentos": return <Atendimentos {...p}/>;
      case "pacientes":    return <Pacientes {...p}/>;
      case "fornecedores": return <Fornecedores {...p}/>;
      case "produtos":     return <Produtos {...p}/>;
      case "procedimentos":return <Procedimentos {...p}/>;
      case "estoque":      return <Estoque {...p}/>;
      case "financeiro":   return <Financeiro {...p}/>;
      case "precos":       return <Precos data={data} update={update}/>;
      case "relatorios":   return <Relatorios data={data} insert={insert}/>;
      case "cadastros":    return <Cadastros {...p}/>;
      case "ia":           return <ChatIA data={data}/>;
      default:             return <Dashboard data={data}/>;
    }
  };

  return (
    <div style={{display:"flex",height:"100vh",background:C.bg,fontFamily:"'DM Sans',sans-serif",color:C.text,overflow:"hidden"}}>
      {/* Sidebar desktop */}
      <div className="sys-sidebar" style={{width:192,background:C.surface,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",padding:"14px 10px",flexShrink:0,overflowY:"auto"}}>
        <div style={{marginBottom:18}}>
          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:2}}>
            <div style={{width:24,height:24,background:C.accent,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center"}}><I.Sparkle c="#0A0A0F" s={12}/></div>
            <span style={{color:C.text,fontWeight:700,fontSize:12}}>EstéticaPro</span>
          </div>
          <div style={{color:C.muted,fontSize:9,marginLeft:31}}>{user.clinica}</div>
          {DEMO_MODE&&<div style={{marginLeft:31,marginTop:2,color:C.warn,fontSize:9}}>● Modo Demo</div>}
        </div>
        <nav style={{flex:1}}>
          {menu.map(item=>{
            const alert=item.alertFn?item.alertFn(data):0;
            return(
              <button key={item.id} className="nb" onClick={()=>setPag(item.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:7,padding:"6px 8px",borderRadius:8,border:"none",marginBottom:1,background:pag===item.id?C.accentSoft:"transparent",color:pag===item.id?C.accent:C.muted,fontWeight:pag===item.id?700:400,fontSize:11,textAlign:"left"}}>
                <item.Icon c={pag===item.id?C.accent:C.muted} s={12}/>
                {item.label}
                {item.id==="ia"&&<span style={{marginLeft:"auto",background:C.accent,color:"#0A0A0F",fontSize:7,fontWeight:800,padding:"1px 5px",borderRadius:20}}>IA</span>}
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
            <span style={{color:C.accent,fontWeight:700,fontSize:13}}>EstéticaPro</span>
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
          <div onClick={()=>setMenuOpen(false)} style={{position:"fixed",inset:0,background:"#000000AA",zIndex:850}}>
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
export default function App() {
  const [tela, setTela] = useState("landing");
  const [user, setUser] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [checkout, setCheckout] = useState(null);

  const handleLogin = u => { setUser(u); setShowLogin(false); setTela("sistema"); };
  const handleLogout = () => { setUser(null); setTela("landing"); };
  const handleCheckoutSuccess = u => { setUser(u); setCheckout(null); setTela("sistema"); };

  return (
    <>
      <GS/>
      {tela==="landing" && <Landing onLogin={()=>setShowLogin(true)} onCheckout={p=>setCheckout(p)}/>}
      {tela==="sistema" && user && <Sistema user={user} onLogout={handleLogout}/>}
      {showLogin && <LoginModal onClose={()=>setShowLogin(false)} onLogin={handleLogin} onGoSignup={()=>{setShowLogin(false);setCheckout("anual");}}/>}
      {checkout && <CheckoutModal plan={checkout} onClose={()=>setCheckout(null)} onSuccess={handleCheckoutSuccess}/>}
    </>
  );
}

