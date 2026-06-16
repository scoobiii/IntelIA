import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Set up larger limit for base64 file payloads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Initialize Gemini client using SDK guidelines
// Set User-Agent as instructed to 'aistudio-build'
let ai: GoogleGenAI | null = null;
try {
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
} catch (error) {
  console.error("Erro ao inicializar GoogleGenAI:", error);
}

// API Routes

// API to generate structured data from a receipt image or pay slip (holerite)
app.post("/api/analyze-document", async (req, res) => {
  try {
    const { imageBase64, mimeType, docType, promptInstructions } = req.body;

    if (!process.env.GEMINI_API_KEY || !ai) {
      return res.status(500).json({
        error: "GEMINI_API_KEY não foi configurada. configure-a no painel de Secrets."
      });
    }

    if (!imageBase64) {
      return res.status(400).json({ error: "Imagem Base64 não fornecida." });
    }

    // Determine target prompt based on docType
    let prompt = "";
    let responseSchema: any = null;

    if (docType === "ponto") {
      prompt = `
        Você é um auditor especialista em ponto de funcionários (CLT).
        Analise a imagem fornecida, que contém um ou mais comprovantes impressos de registro de ponto (comprovante de ponto).
        Extraia todos os registros legíveis que encontrar.
        Retorne os registros em formato estruturado.

        Para cada comprovante de ponto, extraia:
        - Nome do funcionário (procure por termos como 'NSR: ... Nome' ou o nome próprio, ex: 'JOSE SOARES SOBRINHO')
        - CNPJ da empresa
        - Nome ou Razão Social da empresa (ex: 'LOGISTOCK PRESTACAO SERV ADM EIRELI')
        - Data do registro (ex: '13/06/2026' ou '13/06/26')
        - Hora do registro (ex: '13:13' ou '17:37')
        - NSR (Número Sequencial de Registro) se disponível

        Instruções adicionais de acurácia de 100%:
        - Retorne uma lista de registros de ponto. Se houver múltiplos comprovantes ou múltiplos pontos na mesma foto, extraia TUDO individualmente.
        - Não invente dados. Só retorne o que for visível.
      `;

      responseSchema = {
        type: Type.OBJECT,
        properties: {
          records: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                employeeName: { type: Type.STRING },
                companyName: { type: Type.STRING },
                cnpj: { type: Type.STRING },
                date: { type: Type.STRING, description: "Data no formato DD/MM/AAAA ou DD/MM/AA" },
                time: { type: Type.STRING, description: "Hora no formato HH:MM" },
                nsr: { type: Type.STRING },
              },
              required: ["employeeName", "date", "time"]
            }
          }
        },
        required: ["records"]
      };

    } else if (docType === "holerite") {
      prompt = `
        Você é um auditor de folha de pagamento (CLT) e holerites.
        Analise a imagem deste holerite (recibo de pagamento) e extraia os valores financeiros e as informações para o cálculo e fechamento do balanço de banco de horas.
        
        Extraia:
        - Nome do funcionário
        - Mês/Ano de referência (ex: '06/2026')
        - Salário base (Salário Base de referência)
        - Valor total pago em Horas Extras (se houver, ex: 'Horas Extras 50%' ou '100%')
        - Total de descontos
        - Salário Líquido (Valor líquido a receber)
        - Horas pagas na folha (ex: '220:00' ou similar)
      `;

      responseSchema = {
        type: Type.OBJECT,
        properties: {
          employeeName: { type: Type.STRING },
          referencePeriod: { type: Type.STRING, description: "Mês e ano, ex: '06/2026'" },
          baseSalary: { type: Type.NUMBER, description: "Salário base em Reais" },
          extraHoursAmount: { type: Type.NUMBER, description: "Horas extras pagas (valor bruto em Reais)" },
          discountsAmount: { type: Type.NUMBER, description: "Total de descontos em Reais" },
          netSalary: { type: Type.NUMBER, description: "Salário líquido a receber em Reais" },
          invoicedHours: { type: Type.STRING, description: "Horas contratadas/pagas na folha, ex: '220h'" }
        },
        required: ["employeeName", "referencePeriod"]
      };

    } else {
      // Inferred lunch photo or check-in location photo
      prompt = `
        Analise a imagem fornecida (como um restaurante de empresa, praça de alimentação ou refeitório).
        Estime a presença e horário sugerido do almoço.
        Retorne informações sobre o tempo de permanência estimado ou inferências baseadas na cena do restaurante.
        Também informe se há alguma irregularidade visual ou se serve como flag de presença física.
      `;

      responseSchema = {
        type: Type.OBJECT,
        properties: {
          location: { type: Type.STRING },
          estimatedDurationMinutes: { type: Type.NUMBER },
          inferenceText: { type: Type.STRING, description: "Texto descritivo explicando a inferência do almoço" },
          presenceConfirmed: { type: Type.BOOLEAN }
        },
        required: ["inferenceText", "presenceConfirmed"]
      };
    }

    if (promptInstructions) {
      prompt += `\nInstrução customizada de acurácia e contexto: ${promptInstructions}`;
    }

    // Call the Gemini 3.5 Flash Model using GoogleGenAI guidelines
    const imagePart = {
      inlineData: {
        mimeType: mimeType || "image/jpeg",
        data: imageBase64,
      },
    };

    const textPart = {
      text: prompt,
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });

    const parsedResult = JSON.parse(response.text || "{}");
    return res.json({ success: true, data: parsedResult });

  } catch (error: any) {
    console.error("Erro na rota de análise:", error);
    return res.status(500).json({ error: error.message || "Erro desconhecido ao processar documento." });
  }
});

// Endpoint stating answer for Geolocation / Google Photos capability
app.get("/api/geo-intel", (req, res) => {
  res.json({
    googlePhotosExifExplanation: `
      1. Rastreamento por EXIF em Fotos: O Google Fotos armazena a geolocalização capturada pelo GPS do celular no metadado EXIF (Exchangeable Image File Format) nas tags 'GPSLatitude' e 'GPSLongitude'.
      2. Link Público/API: A API pública do Google Fotos (Google Photos Library API) permite o acesso a metadados de mídia, porém, por padrão, as informações de geolocalização EXIF são omitidas/removidas de links compartilhados para proteger a privacidade dos usuários, a menos que o app use o escopo de autenticação completo de leitura e o usuário permita explicitamente o compartilhamento de local nas configurações do Google Fotos.
      3. Rastreamento em Tempo Real do Ponto: Para garantir acurácia de 100% no controle geográfico, aplica-se o geofencing por HTML5 Geolocation API integrado, salvando as coordenadas precisas do dispositivo no momento exato em que o ponto é batido na empresa.
    `
  });
});

// Vite & Static assets integration
let startVite = async () => {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // SPA Routing Fallback
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
};

startVite().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT} (ENV: ${process.env.NODE_ENV || 'development'})`);
  });
});
