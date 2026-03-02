import { parse } from 'csv-parse/sync';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG_ID,
});

interface TweetData {
  date: string;
  text: string;
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
}

export async function generateIdeasFromCSV(csvContent: string): Promise<string> {
  try {
    // Parse CSV
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    // Filter out comments (rows with @mentions)
    const filtered = records.filter((row: any) => {
      const text = row['Texto del post'] || row['Tweet text'] || row['Text'] || '';
      return !text.includes('@');
    });

    // Extract tweet data
    const tweets: TweetData[] = filtered.map((row: any) => ({
      date: row['Fecha'] || row['Date'] || row['time'] || '',
      text: row['Texto del post'] || row['Tweet text'] || row['Text'] || '',
      impressions: parseInt(row['Impresiones'] || row['impressions'] || row['Impressions'] || '0'),
      likes: parseInt(row['Me gusta'] || row['likes'] || row['Likes'] || '0'),
      retweets: parseInt(row['Retweets'] || row['retweets'] || '0'),
      replies: parseInt(row['Respuestas'] || row['replies'] || row['Replies'] || '0'),
    }));

    // Sort by impressions and get top 20
    const topTweets = tweets
      .filter(t => t.impressions > 0)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 20);

    if (topTweets.length === 0) {
      return '❌ No se encontraron posts válidos en el CSV (puede que todos sean comentarios o el formato no sea correcto).';
    }

    // Prepare context for OpenAI
    const topTweetsContext = topTweets.slice(0, 10).map((t, i) => 
      `${i + 1}. "${t.text}" - ${t.impressions.toLocaleString()} impresiones`
    ).join('\n');

    const prompt = `Eres un experto en contenido viral de Twitter/X especializado en finanzas personales.

Te voy a dar los 10 posts con más impresiones de esta cuenta:

${topTweetsContext}

---

**TU TAREA:**

Analiza los patrones de lo que funciona y genera **10 IDEAS NUEVAS** de contenido que puedan tener similar o mejor engagement.

**REQUISITOS:**

1. **Variedad:** Las 10 ideas deben ser diferentes entre sí (no repitas el mismo patrón)
2. **Genéricas:** No copies literalmente los posts, usa los patrones pero con temas/ángulos distintos
3. **Virales:** Aplica los mismos principios que hacen viral a los top posts
4. **Formato:** Cada idea debe incluir:
   - **Tipo de post:** (historia personal, lista, dilema, hack, etc.)
   - **Gancho:** La primera línea que para el scroll
   - **Estructura:** Resumen de qué contenido iría

**FORMATO DE RESPUESTA:**

Para cada idea (1-10):

**Idea X: [Tipo de post]**
🎯 Gancho: "[Primera línea potente]"
📝 Estructura: [Breve descripción de qué incluiría el post]

---

Sé creativo pero mantente en temas de finanzas personales, ahorro, inversión, economía doméstica, etc.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Eres un experto en contenido viral de Twitter/X especializado en finanzas personales.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8, // Moderada para variedad
      max_tokens: 2000,
    });

    const ideas = response.choices[0]?.message?.content || '❌ Error generando ideas';

    return `📊 **Análisis completado**\n\n✅ ${tweets.length} posts analizados\n🚫 ${records.length - tweets.length} comentarios eliminados\n🔥 Top post: ${topTweets[0].impressions.toLocaleString()} impresiones\n\n---\n\n${ideas}`;
  } catch (error) {
    console.error('Error analyzing CSV:', error);
    return `❌ Error analizando el CSV: ${error instanceof Error ? error.message : 'Error desconocido'}`;
  }
}
