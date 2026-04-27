"use client";

import Image from "next/image";
import { useState } from "react";
import {
  Newspaper, Users, Building2, Handshake, AlertTriangle, BarChart3,
  Settings, Search, Filter, ThumbsUp, Ban,
  Globe, Zap, Shield, Clock, ChevronDown, ChevronRight,
  Sparkles, RefreshCw, Database, Link2
} from "lucide-react";

// ─── i18n ────────────────────────────────────────────────────────────────────

type Lang = "pt" | "en" | "es";

const LANG_LABELS: Record<Lang, string> = { pt: "Português", en: "English", es: "Español" };

const t: Record<string, Record<Lang, string>> = {
  // Hero
  heroTitle: {
    pt: "Central de Ajuda",
    en: "Help Center",
    es: "Centro de Ayuda",
  },
  heroSubtitle: {
    pt: "Tudo que você precisa saber para usar o Market Intelligence Radar.",
    en: "Everything you need to know to use Market Intelligence Radar.",
    es: "Todo lo que necesitas saber para usar Market Intelligence Radar.",
  },

  // What is Market Intelligence Radar
  whatIsTitle: {
    pt: "O que é o Market Intelligence Radar?",
    en: "What is Market Intelligence Radar?",
    es: "¿Qué es Market Intelligence Radar?",
  },
  whatIsDesc: {
    pt: "O Market Intelligence Radar é uma plataforma de inteligência de mercado que monitora fontes de notícias configuráveis, extraindo pessoas, empresas, deals e sinais relevantes para o seu setor. O pipeline combina scan de fontes, enriquecimento automático (Apollo + SalesQL) e matching com contatos do seu CRM. Cada pessoa é classificada por divisão com base no seu perfil e nas regras ICP configuradas.",
    en: "Market Intelligence Radar is a market intelligence platform that monitors configurable news sources, extracting people, companies, deals, and signals relevant to your industry. The pipeline combines source scanning, automatic enrichment (Apollo + SalesQL), and matching against your CRM contacts. Each person is classified by division based on their profile and configurable ICP rules.",
    es: "Market Intelligence Radar es una plataforma de inteligencia de mercado que monitorea fuentes de noticias configurables, extrayendo personas, empresas, deals y señales relevantes para tu sector. El pipeline combina escaneo de fuentes, enriquecimiento automático (Apollo + SalesQL) y matching con contactos de tu CRM. Cada persona se clasifica por división según su perfil y las reglas ICP configurables.",
  },

  // How it works
  howTitle: {
    pt: "Como funciona?",
    en: "How does it work?",
    es: "¿Cómo funciona?",
  },
  step1Title: { pt: "Coleta", en: "Collection", es: "Recolección" },
  step1Desc: {
    pt: "O MIR executa o scan diário das fontes ativas via Firecrawl (com fallback BeautifulSoup). O scan principal roda diariamente.",
    en: "MIR runs a daily scan of active sources via Firecrawl (with BeautifulSoup fallback). The main scan runs daily.",
    es: "MIR ejecuta un escaneo diario de las fuentes activas vía Firecrawl (con fallback BeautifulSoup). El escaneo principal se ejecuta diariamente.",
  },
  step2Title: { pt: "Extração com IA", en: "AI Extraction", es: "Extracción con IA" },
  step2Desc: {
    pt: "O LLM configurado analisa cada artigo e extrai pessoas, empresas, deals, sinais e tópicos usando a taxonomia configurável.",
    en: "The configured LLM analyses each article and extracts people, companies, deals, signals, and topics using the configurable taxonomy.",
    es: "El LLM configurado analiza cada artículo y extrae personas, empresas, deals, señales y temas usando la taxonomía configurable.",
  },
  step3Title: { pt: "Deduplicação", en: "Deduplication", es: "Deduplicación" },
  step3Desc: {
    pt: "Pessoas e empresas são consolidadas via canonical_id (SHA256 de nome+empresa), vinculando menções de múltiplos artigos.",
    en: "People and companies are consolidated via canonical_id (SHA256 of name+company), linking mentions from multiple articles.",
    es: "Personas y empresas se consolidan vía canonical_id (SHA256 de nombre+empresa), vinculando menciones de múltiples artículos.",
  },
  step4Title: { pt: "Enriquecimento", en: "Enrichment", es: "Enriquecimiento" },
  step4Desc: {
    pt: "Cada contato é enriquecido via Apollo.io (email, telefone, indústria) e SalesQL para complementar LinkedIn quando necessário.",
    en: "Each contact is enriched via Apollo.io (email, phone, industry) and SalesQL to complement LinkedIn when needed.",
    es: "Cada contacto se enriquece vía Apollo.io (email, teléfono, industria) y SalesQL para complementar LinkedIn cuando sea necesario.",
  },
  step5Title: { pt: "Classificação por Divisão", en: "Division Classification", es: "Clasificación por División" },
  step5Desc: {
    pt: "Cada pessoa é classificada em divisões com base em setores + país de residência. Divisões, setores e regras ICP são totalmente configuráveis no painel Admin.",
    en: "Each person is classified into divisions based on sectors + country of residence. Divisions, sectors, and ICP rules are fully configurable in the Admin panel.",
    es: "Cada persona se clasifica en divisiones según sectores + país de residencia. Divisiones, sectores y reglas ICP son totalmente configurables en el panel Admin.",
  },
  step6Title: { pt: "Matching CRM", en: "CRM Matching", es: "Matching CRM" },
  step6Desc: {
    pt: "Matching em 4 níveis contra o CRM: email exato (1.0) → nome completo exato (0.8) → prefixo do nome (0.7) → nome+empresa (0.6). Isso identifica quem já está no seu CRM e quem é um potencial prospect novo.",
    en: "4-tier matching against the CRM: exact email (1.0) → exact full name (0.8) → name prefix (0.7) → name+company (0.6). This identifies who is already in your CRM and who is a potential new prospect.",
    es: "Matching en 4 niveles contra el CRM: email exacto (1.0) → nombre completo exacto (0.8) → prefijo del nombre (0.7) → nombre+empresa (0.6). Esto identifica quién ya está en tu CRM y quién es un prospect potencialmente nuevo.",
  },

  // Pages
  pagesTitle: {
    pt: "Navegação — Páginas do Dashboard",
    en: "Navigation — Dashboard Pages",
    es: "Navegación — Páginas del Dashboard",
  },

  overviewTitle: { pt: "Overview", en: "Overview", es: "Overview" },
  overviewDesc: {
    pt: "Visão geral do radar: KPIs principais (artigos, pessoas, empresas, deals), breakdown por divisão, sentimento dos artigos e fontes mais produtivas.",
    en: "Radar overview: key KPIs (articles, people, companies, deals), breakdown by division, article sentiment, and top-producing sources.",
    es: "Visión general del radar: KPIs principales (artículos, personas, empresas, deals), desglose por división, sentimiento de artículos y fuentes más productivas.",
  },

  articlesTitle: { pt: "Articles", en: "Articles", es: "Articles" },
  articlesDesc: {
    pt: "Lista completa de artigos monitorados com título, fonte, divisão, sentimento e data. Clique em qualquer artigo para ver o conteúdo completo e as entidades extraídas.",
    en: "Full list of monitored articles with title, source, division, sentiment, and date. Click any article to view full content and extracted entities.",
    es: "Lista completa de artículos monitoreados con título, fuente, división, sentimiento y fecha. Haga clic en cualquier artículo para ver el contenido completo y las entidades extraídas.",
  },

  peopleTitle: { pt: "People", en: "People", es: "People" },
  peopleDesc: {
    pt: "Duas áreas de abas. Pipeline (ciclo de vida): New Prospect → Enriched → All Identified → Not Found in Enrichment → Not Relevant. Review (decisões humanas): Approved → Reproved. Cada card mostra nome, cargo, empresa, email, LinkedIn, quality score e divisões. Busca por nome, empresa, cargo, email ou país disponível em todas as abas.",
    en: "Two tab groups. Pipeline (lifecycle): New Prospect → Enriched → All Identified → Not Found in Enrichment → Not Relevant. Review (human decisions): Approved → Reproved. Each card shows name, title, company, email, LinkedIn, quality score, and divisions. Search by name, company, title, email, or country is available across all tabs.",
    es: "Dos grupos de pestañas. Pipeline (ciclo de vida): New Prospect → Enriched → All Identified → Not Found in Enrichment → Not Relevant. Review (decisiones humanas): Approved → Reproved. Cada tarjeta muestra nombre, cargo, empresa, email, LinkedIn, quality score y divisiones. Búsqueda por nombre, empresa, cargo, email o país disponible en todas las pestañas.",
  },

  companiesTitle: { pt: "Companies", en: "Companies", es: "Companies" },
  companiesDesc: {
    pt: "Todas as empresas mencionadas, com setor, categoria de operação, países e vínculo com deals. Badge 'In CRM' indica presença no seu CRM.",
    en: "All mentioned companies, with sector, category of operation, countries, and deal involvement. 'In CRM' badge indicates presence in your CRM.",
    es: "Todas las empresas mencionadas, con sector, categoría de operación, países y vínculo con deals. Badge 'In CRM' indica presencia en tu CRM.",
  },

  dealsTitle: { pt: "Deals", en: "Deals", es: "Deals" },
  dealsDesc: {
    pt: "Transações extraídas: aquisições, investimentos, JVs, fundraisings, IPOs, developments. Inclui partes envolvidas, valor, setor e estágio.",
    en: "Extracted transactions: acquisitions, investments, JVs, fundraisings, IPOs, developments. Includes parties involved, value, sector, and stage.",
    es: "Transacciones extraídas: adquisiciones, inversiones, JVs, fundraisings, IPOs, developments. Incluye partes involucradas, valor, sector y etapa.",
  },

  signalsTitle: { pt: "Signals", en: "Signals", es: "Signals" },
  signalsDesc: {
    pt: "Sinais de mercado: regulatório, política, mudança de mercado, novos desenvolvimentos, tecnologia, sustentabilidade e riscos. Classificados por impacto (alto/médio/baixo).",
    en: "Market signals: regulatory, policy, market shift, new developments, technology, sustainability, and risks. Classified by impact (high/medium/low).",
    es: "Señales de mercado: regulatorio, política, cambio de mercado, nuevos desarrollos, tecnología, sostenibilidad y riesgos. Clasificados por impacto (alto/medio/bajo).",
  },

  adminTitle: { pt: "Admin", en: "Admin", es: "Admin" },
  adminDesc: {
    pt: "Painel de administração com métricas do pipeline, fontes por divisão, ICPs (Ideal Customer Profiles) e hard exclusions.",
    en: "Admin panel with pipeline metrics, sources by division, ICPs (Ideal Customer Profiles), and hard exclusions.",
    es: "Panel de administración con métricas del pipeline, fuentes por división, ICPs (Ideal Customer Profiles) y hard exclusions.",
  },

  // Features
  featuresTitle: {
    pt: "Funcionalidades Principais",
    en: "Key Features",
    es: "Funcionalidades Principales",
  },

  divFilterTitle: { pt: "Filtro por Divisão", en: "Division Filter", es: "Filtro por División" },
  divFilterDesc: {
    pt: "O seletor no topo direito filtra as páginas do dashboard por divisão. Divisões são configuráveis no Admin. Uma pessoa pode pertencer a múltiplas divisões.",
    en: "The selector in the top right filters dashboard pages by division. Divisions are configurable in Admin. A person can belong to multiple divisions.",
    es: "El selector en la esquina superior derecha filtra las páginas del dashboard por división. Las divisiones son configurables en Admin. Una persona puede pertenecer a múltiples divisiones.",
  },

  approveFlowTitle: { pt: "Aprovar / Reprovar Prospects", en: "Approve / Reprove Prospects", es: "Aprobar / Reprobar Prospects" },
  approveFlowDesc: {
    pt: "Os botões de ✅ Approve e ❌ Reprove aparecem nas abas New Prospect, Enriched e All Identified. A seleção em lote por checkbox fica disponível em New Prospect e Approved. Na aba Approved, o usuário pode desaprovar ou marcar como not relevant.",
    en: "The ✅ Approve and ❌ Reprove buttons appear in New Prospect, Enriched, and All Identified. Bulk checkbox selection is available in New Prospect and Approved. In Approved, users can unapprove or mark as not relevant.",
    es: "Los botones ✅ Approve y ❌ Reprove aparecen en New Prospect, Enriched y All Identified. La selección masiva con checkbox está disponible en New Prospect y Approved. En Approved, el usuario puede desaprobar o marcar como not relevant.",
  },

  exclusionTitle: { pt: "Regras de Exclusão", en: "Exclusion Rules", es: "Reglas de Exclusión" },
  exclusionDesc: {
    pt: "O ícone 🚫 representa hard exclusion. Use-o só para casos fortes, como uma pessoa exata ou um padrão realmente inválido. Para filtrar prospects por categoria, cargo, setor ou país, prefira regras do ICP da divisão.",
    en: "The 🚫 icon represents hard exclusion. Use it only for strong cases, such as an exact person or a truly invalid pattern. To filter prospects by category, title, sector, or country, prefer division ICP rules.",
    es: "El ícono 🚫 representa hard exclusion. Úsalo solo en casos fuertes, como una persona exacta o un patrón realmente inválido. Para filtrar prospects por categoría, cargo, sector o país, prioriza reglas del ICP de la división.",
  },

  qualityScoreTitle: { pt: "Quality Score", en: "Quality Score", es: "Quality Score" },
  qualityScoreDesc: {
    pt: "Mede a completude dos dados do contato, de 0 a 10. Pontuação: email (+2), LinkedIn (+2), C-level (+3) / Director (+2) / Manager (+1) / Analyst (+0), setores mapeados (+2), empresa identificada (+1).",
    en: "Measures data completeness for a contact, from 0 to 10. Scoring: email (+2), LinkedIn (+2), C-level (+3) / Director (+2) / Manager (+1) / Analyst (+0), mapped sectors (+2), identified company (+1).",
    es: "Mide la completitud de datos del contacto, de 0 a 10. Puntuación: email (+2), LinkedIn (+2), C-level (+3) / Director (+2) / Manager (+1) / Analyst (+0), sectores mapeados (+2), empresa identificada (+1).",
  },

  icpMatchTitle: { pt: "ICP Match", en: "ICP Match", es: "ICP Match" },
  icpMatchDesc: {
    pt: "Mede o quão relevante a pessoa é para uma divisão. O score compara até 4 dimensões configuradas no ICP da divisão: Categoria de atuação, Setores, Países e Cargo/Role. Cálculo: % = dimensões atendidas ÷ dimensões definidas.",
    en: "Measures how relevant a person is to a division. The score compares up to 4 dimensions configured in the division ICP: Category of operation, Sectors, Countries, and Role. Calculation: % = matched dimensions ÷ defined dimensions.",
    es: "Mide qué tan relevante es una persona para una división. El score compara hasta 4 dimensiones configuradas en el ICP de la división: Categoría de actuación, Sectores, Países y Cargo/Role. Cálculo: % = dimensiones cumplidas ÷ dimensiones definidas.",
  },

  crmBadgeTitle: { pt: "Badges CRM", en: "CRM Badges", es: "Badges CRM" },
  crmBadgeDesc: {
    pt: "'In CRM' = já existe no seu CRM (com tipo de match: email/name exact/name prefix/name+company). 'NEW' = não encontrado — potencial prospect novo.",
    en: "'In CRM' = already exists in your CRM (with match type: email/name exact/name prefix/name+company). 'NEW' = not found — potential new prospect.",
    es: "'In CRM' = ya existe en tu CRM (con tipo de match: email/name exact/name prefix/name+company). 'NEW' = no encontrado — potencial prospect nuevo.",
  },

  realtimeTitle: { pt: "Status de Enriquecimento", en: "Enrichment Status", es: "Estado de Enriquecimiento" },
  realtimeDesc: {
    pt: "Na aba All Identified, o status do job de enrichment é consultado automaticamente a cada 3 segundos enquanto o processamento está em andamento.",
    en: "In the All Identified tab, the enrichment job status is polled automatically every 3 seconds while processing is running.",
    es: "En la pestaña All Identified, el estado del job de enrichment se consulta automáticamente cada 3 segundos mientras el procesamiento está en curso.",
  },

  // Taxonomy
  taxonomyTitle: {
    pt: "Taxonomia Configurável",
    en: "Configurable Taxonomy",
    es: "Taxonomía Configurable",
  },
  taxonomyDesc: {
    pt: "Todos os dados extraídos são classificados usando a taxonomia configurável:",
    en: "All extracted data is classified using the configurable taxonomy:",
    es: "Todos los datos extraídos se clasifican usando la taxonomía configurable:",
  },
  taxonomyDims: {
    pt: "Sector · Category of Operation · Category of Interest · Country · City · Deal Size · Investment Strategy · Portfolio Strategy · Region · geo_region",
    en: "Sector · Category of Operation · Category of Interest · Country · City · Deal Size · Investment Strategy · Portfolio Strategy · Region · geo_region",
    es: "Sector · Category of Operation · Category of Interest · Country · City · Deal Size · Investment Strategy · Portfolio Strategy · Region · geo_region",
  },

  // Auto-filters
  autoFilterTitle: {
    pt: "Filtros Automáticos de Relevância",
    en: "Automatic Relevance Filters",
    es: "Filtros Automáticos de Relevancia",
  },
  autoFilterDesc: {
    pt: "O MIR pode filtrar automaticamente contatos irrelevantes (configurável via ICP e exclusions):",
    en: "MIR can automatically filter out irrelevant contacts (configurable via ICP and exclusions):",
    es: "MIR puede filtrar automáticamente contactos irrelevantes (configurable vía ICP y exclusiones):",
  },
  autoFilterList: {
    pt: "Políticos e funcionários do governo · Jornalistas e autores de artigos · Acadêmicos e pesquisadores · Celebridades, atletas e artistas · Contatos sem setor relevante · Contatos sem email nem LinkedIn",
    en: "Politicians and government officials · Journalists and article authors · Academics and researchers · Celebrities, athletes, and artists · Contacts without a relevant sector · Contacts without email or LinkedIn",
    es: "Políticos y funcionarios del gobierno · Periodistas y autores de artículos · Académicos e investigadores · Celebridades, atletas y artistas · Contactos sin sector relevante · Contactos sin email ni LinkedIn",
  },

  // FAQ
  faqTitle: { pt: "Perguntas Frequentes", en: "FAQ", es: "Preguntas Frecuentes" },

  faq1q: {
    pt: "Com que frequência os dados são atualizados?",
    en: "How often is data updated?",
    es: "¿Con qué frecuencia se actualizan los datos?",
  },
  faq1a: {
    pt: "O pipeline roda diariamente em etapas separadas: scan das fontes, enriquecimento de contatos e matching com CRM. A frequência é configurável.",
    en: "The pipeline runs daily in separate stages: source scanning, contact enrichment, and CRM matching. Frequency is configurable.",
    es: "El pipeline se ejecuta diariamente en etapas separadas: escaneo de fuentes, enriquecimiento de contactos y matching con CRM. La frecuencia es configurable.",
  },

  faq2q: {
    pt: "O que significa cada aba de People?",
    en: "What does each People tab mean?",
    es: "¿Qué significa cada pestaña de People?",
  },
  faq2a: {
    pt: "As abas são organizadas em dois grupos:\n\n📊 Pipeline (ciclo de vida do contato):\n• New Prospect — Prospects novos prontos para review.\n• Enriched — Contatos enriquecidos com sucesso.\n• All Identified — Visão geral de todos os contatos extraídos.\n• Not Found in Enrichment — Contatos não encontrados nos provedores de enriquecimento.\n• Not Relevant — Contatos filtrados por irrelevância.\n\n✅ Review (decisões humanas):\n• Approved — Prospects aprovados manualmente.\n• Reproved — Prospects reprovados manualmente.",
    en: "Tabs are organized in two groups:\n\n📊 Pipeline (contact lifecycle):\n• New Prospect — New prospects ready for review.\n• Enriched — Successfully enriched contacts.\n• All Identified — Overview of all extracted contacts.\n• Not Found in Enrichment — Contacts not found by enrichment providers.\n• Not Relevant — Contacts filtered for irrelevance.\n\n✅ Review (human decisions):\n• Approved — Manually approved prospects.\n• Reproved — Manually reproved prospects.",
    es: "Las pestañas están organizadas en dos grupos:\n\n📊 Pipeline (ciclo de vida del contacto):\n• New Prospect — Prospects nuevos listos para revisión.\n• Enriched — Contactos enriquecidos con éxito.\n• All Identified — Visión general de todos los contactos extraídos.\n• Not Found in Enrichment — Contactos no encontrados por los proveedores de enriquecimiento.\n• Not Relevant — Contactos filtrados por irrelevancia.\n\n✅ Review (decisiones humanas):\n• Approved — Prospects aprobados manualmente.\n• Reproved — Prospects reprobados manualmente.",
  },

  faq3q: {
    pt: "Quem pode acessar o Market Intelligence Radar?",
    en: "Who can access Market Intelligence Radar?",
    es: "¿Quién puede acceder a Market Intelligence Radar?",
  },
  faq3a: {
    pt: "Apenas usuários com credenciais configuradas no .env (AUTH_EMAIL / AUTH_PASSWORD). Autenticação é feita via JWT.",
    en: "Only users with credentials configured in .env (AUTH_EMAIL / AUTH_PASSWORD). Authentication uses JWT.",
    es: "Solo usuarios con credenciales configuradas en .env (AUTH_EMAIL / AUTH_PASSWORD). La autenticación usa JWT.",
  },

  faq4q: {
    pt: "O que acontece quando aprovo um prospect?",
    en: "What happens when I approve a prospect?",
    es: "¿Qué pasa cuando apruebo un prospect?",
  },
  faq4a: {
    pt: "O prospect sai da aba New Prospect e vai para Approved. Você pode exportar prospects aprovados via CSV para importar no CRM de sua escolha.",
    en: "The prospect leaves New Prospect and moves to Approved. You can export approved prospects via CSV to import into your CRM of choice.",
    es: "El prospect sale de New Prospect y va a Approved. Puedes exportar los prospects aprobados vía CSV para importarlos al CRM que prefieras.",
  },

  faq5q: {
    pt: "Posso ver de qual artigo veio cada pessoa?",
    en: "Can I see which article each person came from?",
    es: "¿Puedo ver de qué artículo proviene cada persona?",
  },
  faq5a: {
    pt: "Sim. Cada card de pessoa mostra a divisão, a fonte e a contagem de menções. Contatos citados em múltiplos artigos exibem um badge 'Nx cited'.",
    en: "Yes. Each person card shows the division, source, and mention count. Contacts cited in multiple articles display an 'Nx cited' badge.",
    es: "Sí. Cada tarjeta de persona muestra la división, la fuente y la cantidad de menciones. Los contactos citados en múltiples artículos muestran un badge 'Nx cited'.",
  },

  faq6q: {
    pt: "Por que uma pessoa aparece em mais de uma divisão?",
    en: "Why does a person appear in more than one division?",
    es: "¿Por qué una persona aparece en más de una división?",
  },
  faq6a: {
    pt: "Divisões são baseadas no perfil da pessoa (setores + países), não na fonte do artigo. Um investidor com atuação em múltiplas regiões é classificado em todas as divisões relevantes.",
    en: "Divisions are based on the person's profile (sectors + countries), not the article source. An investor active in multiple regions is classified in all relevant divisions.",
    es: "Las divisiones se basan en el perfil de la persona (sectores + países), no en la fuente del artículo. Un inversor activo en múltiples regiones se clasifica en todas las divisiones relevantes.",
  },
};

// ─── Components ──────────────────────────────────────────────────────────────

function Section({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`mb-10 ${className}`}>
      <h2 className="text-lg font-semibold mb-4 text-[var(--foreground)]">{title}</h2>
      {children}
    </section>
  );
}

function StepCard({ number, icon: Icon, title, desc }: { number: number; icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="flex gap-3 items-start p-4 rounded-lg bg-[var(--muted)] border border-[var(--border)]">
      <div className="flex-none w-8 h-8 rounded-full bg-blue-600/20 text-blue-500 flex items-center justify-center text-xs font-bold">
        {number}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Icon size={14} className="text-blue-500 flex-none" />
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function PageCard({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="flex gap-3 items-start p-3 rounded-lg hover:bg-[var(--muted)] transition-colors">
      <Icon size={16} className="text-[var(--muted-foreground)] flex-none mt-0.5" />
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-[var(--muted-foreground)] leading-relaxed mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[var(--border)] rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-[var(--muted)] transition-colors"
      >
        {open ? <ChevronDown size={14} className="flex-none text-[var(--muted-foreground)]" /> : <ChevronRight size={14} className="flex-none text-[var(--muted-foreground)]" />}
        <span className="text-sm font-medium">{question}</span>
      </button>
      {open && (
        <div className="px-4 pb-3 pt-0 ml-6">
          <p className="text-xs text-[var(--muted-foreground)] leading-relaxed whitespace-pre-line">{answer}</p>
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function HelpPage() {
  const [lang, setLang] = useState<Lang>("en");

  return (
    <div className="max-w-3xl mx-auto">
      {/* Language switcher */}
      <div className="flex items-center justify-end gap-1 mb-6">
        {(Object.keys(LANG_LABELS) as Lang[]).map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              lang === l
                ? "bg-blue-600 text-white"
                : "bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            {LANG_LABELS[l]}
          </button>
        ))}
      </div>

      {/* Hero */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center">
            <Image
              src="/favicon-32x32.png"
              alt="Market Intelligence Radar"
              width={20}
              height={20}
              className="h-5 w-5"
            />
          </div>
          <h1 className="text-xl font-bold">{t.heroTitle[lang]}</h1>
        </div>
        <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">{t.heroSubtitle[lang]}</p>
      </div>

      {/* What is Market Intelligence Radar */}
      <Section title={t.whatIsTitle[lang]}>
        <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">{t.whatIsDesc[lang]}</p>
      </Section>

      {/* How it works */}
      <Section title={t.howTitle[lang]}>
        <div className="space-y-3">
          <StepCard number={1} icon={Globe} title={t.step1Title[lang]} desc={t.step1Desc[lang]} />
          <StepCard number={2} icon={Sparkles} title={t.step2Title[lang]} desc={t.step2Desc[lang]} />
          <StepCard number={3} icon={Link2} title={t.step3Title[lang]} desc={t.step3Desc[lang]} />
          <StepCard number={4} icon={Database} title={t.step4Title[lang]} desc={t.step4Desc[lang]} />
          <StepCard number={5} icon={Filter} title={t.step5Title[lang]} desc={t.step5Desc[lang]} />
          <StepCard number={6} icon={RefreshCw} title={t.step6Title[lang]} desc={t.step6Desc[lang]} />
        </div>
      </Section>

      {/* Navigation */}
      <Section title={t.pagesTitle[lang]}>
        <div className="space-y-1">
          <PageCard icon={BarChart3} title={t.overviewTitle[lang]} desc={t.overviewDesc[lang]} />
          <PageCard icon={Newspaper} title={t.articlesTitle[lang]} desc={t.articlesDesc[lang]} />
          <PageCard icon={Users} title={t.peopleTitle[lang]} desc={t.peopleDesc[lang]} />
          <PageCard icon={Building2} title={t.companiesTitle[lang]} desc={t.companiesDesc[lang]} />
          <PageCard icon={Handshake} title={t.dealsTitle[lang]} desc={t.dealsDesc[lang]} />
          <PageCard icon={AlertTriangle} title={t.signalsTitle[lang]} desc={t.signalsDesc[lang]} />
          <PageCard icon={Settings} title={t.adminTitle[lang]} desc={t.adminDesc[lang]} />
        </div>
      </Section>

      {/* Features */}
      <Section title={t.featuresTitle[lang]}>
        <div className="space-y-4">
          {[
            { icon: Filter, title: t.divFilterTitle[lang], desc: t.divFilterDesc[lang] },
            { icon: ThumbsUp, title: t.approveFlowTitle[lang], desc: t.approveFlowDesc[lang] },
            { icon: Ban, title: t.exclusionTitle[lang], desc: t.exclusionDesc[lang] },
            { icon: Zap, title: t.qualityScoreTitle[lang], desc: t.qualityScoreDesc[lang] },
            { icon: Shield, title: t.icpMatchTitle[lang], desc: t.icpMatchDesc[lang] },
            { icon: Search, title: t.crmBadgeTitle[lang], desc: t.crmBadgeDesc[lang] },
            { icon: Clock, title: t.realtimeTitle[lang], desc: t.realtimeDesc[lang] },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-3 items-start">
              <Icon size={16} className="text-blue-500 flex-none mt-0.5" />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold mb-1">{title}</h3>
                <div className="text-xs text-[var(--muted-foreground)] leading-relaxed whitespace-pre-line">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Taxonomy */}
      <Section title={t.taxonomyTitle[lang]}>
        <p className="text-sm text-[var(--muted-foreground)] leading-relaxed mb-3">{t.taxonomyDesc[lang]}</p>
        <div className="flex flex-wrap gap-2">
          {t.taxonomyDims[lang].split(" · ").map((dim) => (
            <span key={dim} className="px-2.5 py-1 rounded-full bg-blue-600/10 text-blue-500 text-[11px] font-medium">
              {dim}
            </span>
          ))}
        </div>
      </Section>

      {/* Auto-filters */}
      <Section title={t.autoFilterTitle[lang]}>
        <p className="text-sm text-[var(--muted-foreground)] mb-3">{t.autoFilterDesc[lang]}</p>
        <div className="flex flex-wrap gap-2">
          {t.autoFilterList[lang].split(" · ").map((item) => (
            <span key={item} className="px-2.5 py-1 rounded-full bg-red-600/10 text-red-400 text-[11px] font-medium">
              {item}
            </span>
          ))}
        </div>
      </Section>

      {/* FAQ */}
      <Section title={t.faqTitle[lang]}>
        <div className="space-y-2">
          <FaqItem question={t.faq1q[lang]} answer={t.faq1a[lang]} />
          <FaqItem question={t.faq2q[lang]} answer={t.faq2a[lang]} />
          <FaqItem question={t.faq3q[lang]} answer={t.faq3a[lang]} />
          <FaqItem question={t.faq4q[lang]} answer={t.faq4a[lang]} />
          <FaqItem question={t.faq5q[lang]} answer={t.faq5a[lang]} />
          <FaqItem question={t.faq6q[lang]} answer={t.faq6a[lang]} />
        </div>
      </Section>
    </div>
  );
}
