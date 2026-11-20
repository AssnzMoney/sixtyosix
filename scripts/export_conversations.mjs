import fs from 'fs';
import path from 'path';
import readline from 'readline';

const transcriptFile = 'C:\\Users\\Alysson\\.gemini\\antigravity\\brain\\431e9482-74a3-42e2-a24e-cd2ab676c0e0\\.system_generated\\logs\\transcript_full.jsonl';
const outDir1 = 'c:\\Users\\Alysson\\sixtyosix\\conversas Antigravity';
const outDir2 = 'C:\\Users\\Alysson\\Documents\\ChatGPT\\minha virada de chave\\conversas Antigravity';

if (!fs.existsSync(outDir1)) fs.mkdirSync(outDir1, { recursive: true });
if (!fs.existsSync(outDir2)) fs.mkdirSync(outDir2, { recursive: true });

async function run() {
  const fileStream = fs.createReadStream(transcriptFile);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let mdContent = '# Histórico Completo de Conversas - SixtySix & Antigravity\n\n';
  mdContent += '> Registro cronológico integral de todas as interações, instruções, testes e decisões técnicas entre o Usuário e Antigravity.\n';
  mdContent += '> Período: 18 de Novembro de 2026 até 20 de Novembro de 2026.\n\n---\n\n';

  const dialogs = [];
  let currentDialog = null;

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const d = JSON.parse(line);
      if (d.type === 'USER_INPUT') {
        const raw = d.content || '';
        let userText = raw;
        const startTag = '<USER_REQUEST>';
        const endTag = '</USER_REQUEST>';
        const sIdx = raw.indexOf(startTag);
        const eIdx = raw.indexOf(endTag);
        if (sIdx !== -1 && eIdx !== -1) {
          userText = raw.substring(sIdx + startTag.length, eIdx).trim();
        } else {
          userText = raw.split('<ADDITIONAL_METADATA>')[0].trim();
        }

        let attachments = [];
        if (d.media && Array.isArray(d.media)) {
          attachments = d.media.map(m => m.uri || m.mime_type);
        }

        currentDialog = {
          step: d.step_index,
          time: d.created_at,
          user: userText,
          attachments,
          modelResponses: []
        };
        dialogs.push(currentDialog);
      } else if (d.type === 'PLANNER_RESPONSE' && currentDialog) {
        if (d.content && typeof d.content === 'string' && d.content.trim()) {
          currentDialog.modelResponses.push({
            step: d.step_index,
            time: d.created_at,
            content: d.content.trim()
          });
        }
      }
    } catch (e) {}
  }

  console.log('Dialogs parsed:', dialogs.length);

  dialogs.forEach((diag, idx) => {
    const dateStr = new Date(diag.time).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    mdContent += `## Diálogo #${idx + 1} — ${dateStr}\n\n`;
    mdContent += '### 👤 Usuário\n\n';
    if (diag.user) {
      mdContent += diag.user + '\n\n';
    } else {
      mdContent += '*(Sem texto de comando)*\n\n';
    }

    if (diag.attachments && diag.attachments.length > 0) {
      mdContent += `**Anexos:** ${diag.attachments.join(', ')}\n\n`;
    }

    if (diag.modelResponses && diag.modelResponses.length > 0) {
      mdContent += '### 🤖 Antigravity\n\n';
      diag.modelResponses.forEach(r => {
        mdContent += r.content + '\n\n';
      });
    }

    mdContent += '---\n\n';
  });

  const targetFile1 = path.join(outDir1, 'HISTORICO-COMPLETO.md');
  const targetFile2 = path.join(outDir2, 'HISTORICO-COMPLETO.md');
  fs.writeFileSync(targetFile1, mdContent, 'utf8');
  fs.writeFileSync(targetFile2, mdContent, 'utf8');
  console.log('Saved:', targetFile1, fs.statSync(targetFile1).size, 'bytes');

  // Copy raw jsonl as well
  fs.copyFileSync(transcriptFile, path.join(outDir1, 'transcricao_bruta.jsonl'));
  fs.copyFileSync(transcriptFile, path.join(outDir2, 'transcricao_bruta.jsonl'));
  console.log('Raw jsonl copied.');
}

run();
