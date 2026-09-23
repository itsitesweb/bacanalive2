const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

function buildPrompt1PDF(outputPath) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, bottom: 40, left: 45, right: 45 },
    bufferPages: true
  });

  const writeStream = fs.createWriteStream(outputPath);
  doc.pipe(writeStream);

  // Cores
  const primaryColor = '#0f172a';   // Slate 900
  const accentColor = '#0284c7';    // Sky 600
  const secondaryColor = '#334155'; // Slate 700
  const mutedColor = '#64748b';     // Slate 500
  const boxBg = '#f8fafc';          // Slate 50
  const boxBorder = '#e2e8f0';      // Slate 200

  // Cabeçalho / Banner
  doc.rect(45, 40, 505, 75).fill(boxBg).stroke(boxBorder);
  
  doc.fillColor(accentColor).fontSize(9).font('Helvetica-Bold')
     .text('BACANALIVE • ARQUITETURA DE INGESTÃO E CRAWLER', 60, 52);
  
  doc.fillColor(primaryColor).fontSize(16).font('Helvetica-Bold')
     .text('Prompt 1: Contexto e Estrutura de Arquivos', 60, 68);

  doc.fillColor(mutedColor).fontSize(9).font('Helvetica')
     .text('Porte do Crawler Python (bridge_web.py) para TypeScript / Node.js • Branch: feature/node-crawler', 60, 92);

  doc.moveDown(3);
  doc.y = 130;

  // Função auxiliar para títulos de seção
  function sectionTitle(title) {
    doc.moveDown(0.8);
    const y = doc.y;
    doc.rect(45, y, 4, 16).fill(accentColor);
    doc.fillColor(primaryColor).fontSize(12).font('Helvetica-Bold')
       .text(title, 55, y + 2);
    doc.moveDown(0.6);
  }

  function subTitle(title) {
    doc.moveDown(0.4);
    doc.fillColor(accentColor).fontSize(10).font('Helvetica-Bold')
       .text(title);
    doc.moveDown(0.2);
  }

  function paragraph(text) {
    doc.fillColor(secondaryColor).fontSize(8.5).font('Helvetica')
       .text(text, { align: 'justify', lineGap: 2 });
    doc.moveDown(0.4);
  }

  function bullet(label, desc) {
    doc.fillColor(primaryColor).fontSize(8.5).font('Helvetica-Bold')
       .text(`• ${label}: `, { continued: true })
       .font('Helvetica').fillColor(secondaryColor)
       .text(desc, { lineGap: 1.5 });
    doc.moveDown(0.25);
  }

  // --- PARTE 1: RESUMO ARQUITETURAL ---
  sectionTitle('1. Resumo da Arquitetura do Crawler Atual (bridge_web.py)');

  paragraph('O bridge_web.py opera como um motor standalone de ingestão esportiva em tempo real. Possui arquitetura desacoplada dividida em 5 pilares:');

  subTitle('1.1 Estruturas de Dados & Catálogo em Memória');
  bullet('MatchTier & TIER_SCAN_TTL_SECONDS', 'Define cadência adaptativa por prioridade: TIER_0 (10s), TIER_05 (5s - Prioridade Máxima Tier 1), TIER_1 (20s), TIER_2 (30s), TIER_3 (45s), HT (35s - Intervalo ativo), NO_STATS (120s) e FINISHED (Infinito).');
  bullet('MatchCatalogEntry & MatchCatalogManager', 'Armazena em memória (com cache em data/crawler_catalog_cache.json) metadados esportivos, timestamps de pontapé real, histórico de scans e detecção de encerramento por estagnação pós-90\'.');
  bullet('resolve_match_status_and_period', 'Função pura determinística que blinda as transições de status (HT com 45\' e stage 38, FT, 1T, 2T e prorrogação), impedindo regressão de jogos no intervalo.');

  subTitle('1.2 Despacho Assíncrono & Heartbeat');
  bullet('Fila de Despacho (_payload_queue)', 'Thread consumidora desacoplada que utiliza HTTP Connection Pooling e retries para enviar atualizações a /api/crawler/webhook sem travar a raspagem.');
  bullet('Loop de Heartbeat (_heartbeat_worker)', 'Emite sinal de vida a cada 8 segundos informando status "running", número de partidas ativas e session_id.');

  subTitle('1.3 Motor de Descoberta (Discovery)');
  bullet('Extração DOM (Playwright)', 'Acessa a grade do Flashscore, ativa filtro AO VIVO, desdobra ligas sanfonadas e executa scripts de extração injetados via evaluate.');
  bullet('Fallback de Feed HTTP Oficial', 'Consome feeds rápidos (/x/feed/f_1_...) com x-fsign: SW9D1eZo para descobrir partidas mesmo se o DOM falhar ou atrasar.');

  subTitle('1.4 Leitura Detalhada da Partida (read_match)');
  bullet('Hierarquia em Cascata de Alta Eficiência', '1º Metadados rápidos (/x/feed/dc_1) -> 2º Estatísticas ofensivas xG/chutes (/x/feed/df_st) -> 3º Incidentes/cartões (/x/feed/df_sui) -> 4º DOM completo apenas se feeds falharem.');

  subTitle('1.5 Loop Principal & Bloqueador de Recursos');
  bullet('Filtro de Rotas Playwright', 'Aborta requisições de mídia, imagens e fontes, poupando 80% de CPU/banda.');
  bullet('Scheduler Multi-Worker', 'Distribui partidas com TTL expirado entre workers concorrentes respeitando cotas rigorosas.');

  // Quebra de Página para Parte 2
  doc.addPage();

  // --- PARTE 2: ESTRUTURA DE PASTAS PROPOSTA ---
  sectionTitle('2. Estrutura de Pastas Proposta (server/crawler-node/)');

  paragraph('A versão TypeScript será modularizada em arquivos enxutos e de responsabilidade única dentro de server/crawler-node/, integrando-se nativamente ao server.ts:');

  const files = [
    { name: 'types.ts', desc: 'Contratos e interfaces TypeScript equivalentes às dataclasses Python (MatchState, MatchCatalogEntry, MatchTier, CrawlerConfig).' },
    { name: 'statusResolver.ts', desc: 'Porte da função determinística resolveMatchStatusAndPeriod, assegurando preservação absoluta do estado HT (minuto 45, stage 38) e transições FT/1T/2T.' },
    { name: 'catalog.ts', desc: 'Porte do MatchCatalogManager com fila de prioridades adaptativa por TIER, detecção de estagnação de minuto e persistência assíncrona em cache JSON.' },
    { name: 'extractors.ts', desc: 'Funções JavaScript puras para execução dentro do navegador via page.evaluate (clique AO VIVO, desdobramento de ligas e extração DOM).' },
    { name: 'flashscoreFeeds.ts', desc: 'Clientes HTTP e decodificadores dos feeds Flashscore (dc_1, df_st, df_sui e feeds delimitados ~ZA÷/~AA÷ com headers oficiais).' },
    { name: 'discovery.ts', desc: 'Orquestração da descoberta de jogos ao vivo com mesclagem inteligente entre Playwright DOM e feeds HTTP.' },
    { name: 'matchReader.ts', desc: 'Leitura completa da partida aplicando a cascata de feeds de estatísticas e fallback de DOM quando necessário.' },
    { name: 'discovery.ts', desc: 'Descoberta de partidas AO VIVO no Flashscore via Playwright e Feed HTTP oficial resiliente.' },
    { name: 'dispatch.ts', desc: 'Fila de despacho interna (atualização direta em memória no matchStore sem overhead HTTP) + rotina de heartbeat a cada 8s.' },
    { name: 'engine.ts', desc: 'Orquestrador do crawler: inicialização do Playwright, bloqueador seletivo de rotas, scheduler de loops e controle de concorrência.' },
    { name: 'index.ts', desc: 'Fachada de exportação pública para o server.ts com suporte à alternância de modos (python, node, both).' }
  ];

  files.forEach(f => {
    bullet(f.name, f.desc);
  });

  // --- PARTE 3: METODOLOGIA DE MIGRAÇÃO ---
  sectionTitle('3. Metodologia de Execução & Garantia de Não-Regressão');

  paragraph('Para assegurar integridade contínua da aplicação durante o porte:');
  bullet('Branch Dedicada', 'Trabalho isolado na branch feature/node-crawler sem afetar a produção.');
  bullet('Não-Interrupção do Crawler Python', 'O script bridge_web.py permanece como o motor ativo primário durante todas as fases iniciais.');
  bullet('Modo Dual Futuro (Prompt 7)', 'Implementação de chave seletora operacional (CRAWLER_MODE = python | node | both) para validação cruzada antes da virada definitiva.');
  bullet('Desenvolvimento em Etapas Estritas', 'Nenhum arquivo seguinte é implementado antes da validação unitária e compilação limpa do arquivo anterior.');

  // Rodapé em todas as páginas
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.rect(45, 790, 505, 0.5).fill(boxBorder);
    doc.fillColor(mutedColor).fontSize(8).font('Helvetica')
       .text('BacanaLive Platform • Documento de Engenharia — Migração do Crawler', 45, 798, { align: 'left' })
       .text(`Página ${i + 1} de ${range.count}`, 45, 798, { align: 'right' });
  }

  doc.end();
}

const outDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}
const pdfPath = path.join(outDir, 'Prompt_1_Migracao_Crawler.pdf');
buildPrompt1PDF(pdfPath);
console.log('PDF gerado com sucesso em:', pdfPath);
