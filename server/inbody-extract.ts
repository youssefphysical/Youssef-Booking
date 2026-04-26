import OpenAI from "openai";
import fs from "fs";

export type InbodyMetrics = {
  weight: number | null;
  bodyFat: number | null;
  muscleMass: number | null;
  bmi: number | null;
  visceralFat: number | null;
  bmr: number | null;
  water: number | null;
  score: number | null;
};

export async function extractInbodyMetricsFromImage(
  filePath: string,
  mimeType: string,
): Promise<InbodyMetrics | null> {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const buf = fs.readFileSync(filePath);
    const base64 = buf.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const completion = await client.chat.completions.create({
      // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      model: "gpt-5",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Read this InBody body composition scan and return a JSON object with these numeric fields (use null when missing): weight (kg), bodyFat (%), muscleMass (kg), bmi, visceralFat (level), bmr (kcal), water (kg), score. Respond ONLY with raw JSON, no commentary.",
            },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const num = (v: unknown) =>
      typeof v === "number" && isFinite(v) ? v : v == null ? null : Number(v) || null;
    return {
      weight: num(parsed.weight),
      bodyFat: num(parsed.bodyFat),
      muscleMass: num(parsed.muscleMass),
      bmi: num(parsed.bmi),
      visceralFat: num(parsed.visceralFat),
      bmr: num(parsed.bmr),
      water: num(parsed.water),
      score: num(parsed.score),
    };
  } catch (err) {
    console.error("[inbody-extract] failed:", (err as Error).message);
    return null;
  }
}
