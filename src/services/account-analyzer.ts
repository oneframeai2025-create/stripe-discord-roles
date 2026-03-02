import { parse } from 'csv-parse/sync';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG_ID,
});

interface TweetAnalysis {
  date: string;
  dayOfWeek: string;
  text: string;
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
  engagement: number;
  engagementRate: number;
}

export async function analyzeAccountFromCSV(csvContent: string, userId: string): Promise<string> {
  try {
    // Parse CSV
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    // Filter out comments/replies (rows with @mentions)
    const mainTweets = records.filter((row: any) => {
      const text = row['Texto del post'] || row['Tweet text'] || row['Text'] || '';
      return !text.includes('@');
    });

    if (mainTweets.length === 0) {
      return '❌ No se encontraron tweets principales (todos parecen ser comentarios/respuestas).';
    }

    // Extract and analyze tweets
    const allTweets: TweetAnalysis[] = mainTweets.map((row: any) => {
      const impressions = parseInt(row['Impresiones'] || row['impressions'] || row['Impressions'] || '0');
      const likes = parseInt(row['Me gusta'] || row['likes'] || row['Likes'] || '0');
      const retweets = parseInt(row['Retweets'] || row['retweets'] || '0');
      const replies = parseInt(row['Respuestas'] || row['replies'] || row['Replies'] || '0');
      const engagement = likes + retweets + replies;
      const engagementRate = impressions > 0 ? (engagement / impressions) * 100 : 0;

      const dateStr = row['Fecha'] || row['Date'] || row['time'] || '';
      const date = new Date(dateStr);
      const dayOfWeek = date.toLocaleDateString('es-ES', { weekday: 'long' });

      return {
        date: dateStr,
        dayOfWeek: dayOfWeek,
        text: row['Texto del post'] || row['Tweet text'] || row['Text'] || '',
        impressions,
        likes,
        retweets,
        replies,
        engagement,
        engagementRate,
      };
    });

    // Sort by impressions (descending) and take top 3000
    const tweets = allTweets
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 3000);

    console.log(`📊 Account analysis: ${allTweets.length} total tweets → analyzing top ${tweets.length} by impressions`);

    // Calculate statistics
    const totalImpressions = tweets.reduce((sum, t) => sum + t.impressions, 0);
    const totalEngagement = tweets.reduce((sum, t) => sum + t.engagement, 0);
    const avgER = tweets.length > 0 ? (totalEngagement / totalImpressions) * 100 : 0;
    
    // Days with activity
    const uniqueDays = new Set(tweets.map(t => t.date.split('T')[0] || t.date.split(' ')[0])).size;

    // Sort by ER to get top content
    const topByER = [...tweets].sort((a, b) => b.engagementRate - a.engagementRate).slice(0, 10);

    // Extract keywords
    const allText = tweets.map(t => t.text.toLowerCase()).join(' ');
    const words = allText
      .replace(/[^\wáéíóúñü\s]/gi, ' ')
      .split(/\s+/)
      .filter(w => w.length > 4 && !['https', 'http', 'tweet', 'post'].includes(w));
    
    const wordFreq: Record<string, number> = {};
    words.forEach(w => {
      wordFreq[w] = (wordFreq[w] || 0) + 1;
    });
    
    const topKeywords = Object.entries(wordFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([word, count]) => ({ word, count }));

    // Analyze by day of week
    const byDay: Record<string, { count: number; totalER: number; tweets: TweetAnalysis[] }> = {};
    tweets.forEach(t => {
      if (!byDay[t.dayOfWeek]) {
        byDay[t.dayOfWeek] = { count: 0, totalER: 0, tweets: [] };
      }
      byDay[t.dayOfWeek].count++;
      byDay[t.dayOfWeek].totalER += t.engagementRate;
      byDay[t.dayOfWeek].tweets.push(t);
    });

    const dayStats = Object.entries(byDay).map(([day, data]) => ({
      day,
      avgER: (data.totalER / data.count).toFixed(2),
      count: data.count,
    })).sort((a, b) => parseFloat(b.avgER) - parseFloat(a.avgER));

    // Analyze by volume (tweets per day)
    const tweetsByDate: Record<string, number> = {};
    tweets.forEach(t => {
      const dateKey = t.date.split('T')[0] || t.date.split(' ')[0];
      tweetsByDate[dateKey] = (tweetsByDate[dateKey] || 0) + 1;
    });

    const volumeAnalysis = Object.values(tweetsByDate).reduce((acc, count) => {
      const range = count <= 2 ? '1-2' : count <= 5 ? '3-5' : count <= 10 ? '6-10' : '10+';
      if (!acc[range]) acc[range] = { count: 0, totalTweets: 0 };
      acc[range].count++;
      acc[range].totalTweets += count;
      return acc;
    }, {} as Record<string, { count: number; totalTweets: number }>);

    // Prepare COMPACT data for deep analysis with GPT-4o
    const dataForAnalysis = {
      totalTweets: tweets.length,
      totalImpressions,
      totalEngagement,
      avgER: avgER.toFixed(2),
      uniqueDays,
      dayStats: dayStats,
      volumeAnalysis: volumeAnalysis,
      topTweetsByER: topByER.slice(0, 10).map(t => ({
        text: t.text.substring(0, 120),
        day: t.dayOfWeek,
        impressions: t.impressions,
        engagement: t.engagement,
        er: t.engagementRate.toFixed(2),
      })),
      keywords: topKeywords.slice(0, 20),
    };

    const prompt = `Eres un analista experto de datos de Twitter/X. Te voy a dar datos de una cuenta personal y necesito que hagas un análisis PROFUNDO y ACCIONABLE.

**DATOS DE LA CUENTA:**

${JSON.stringify(dataForAnalysis, null, 2)}

---

**TU TAREA:**

Genera un análisis completo en el siguiente formato EXACTO:

<@${userId}> 📊 **RESUMEN**
• [X] tweets principales (sin respuestas)
• ER promedio: [X]% ([comparación con media Twitter])
• [X] días con actividad
• [X] impresiones totales
• [X] engagement total

🎯 **HALLAZGOS CLAVE**

1. **Engagement [calificativo]:**
   • [X]% ER (vs [Y]% promedio Twitter)
   • [Interpretación del dato]

2. **Días de oro (DATOS REALES):**
   • [Día]: [X]% ER [emoji]
   • [Día]: [X]% ER [emoji]
   • [Día]: [X]% ER [emoji]
   • [Otros días]: ~[X]% ER

3. **Volumen óptimo:**
   • [Patrón 1]: [X]% ER
   • [Patrón 2]: [X]% ER
   • **Conclusión clave**

4. **Contenido ganador:**
   • [Tipo 1]: [X]% ER
   • [Tipo 2]: [X]% ER
   • [Tipo 3]: [X]% ER
   • [Tipo 4]: [X]% ER

5. **Mejor tweet:**
   • "[Extracto del tweet]"
   • [X] imp, [X]% ER [emoji]

🔑 **KEYWORDS TOP 20**

1. [palabra] ([X]x)
2. [palabra] ([X]x)
[... hasta 20]

Palabras/cifras signature:
• [Dato característico 1]
• [Dato característico 2]
• [Dato característico 3]

📈 **FÓRMULA GANADORA**

[Mejor día] + [Frecuencia óptima] + [Tipo de hook] + [Narrativa característica] + [Elemento diferenciador] = >[X]% ER

---

**INSTRUCCIONES CRÍTICAS:**

1. **Usa datos REALES** del JSON que te pasé
2. **Analiza patrones** de verdad (días de semana, volumen, tipo de contenido)
3. **Sé específico** con números y porcentajes
4. **Identifica la narrativa/voz** única de la cuenta
5. **Da insights accionables**, no descripciones genéricas
6. **Usa emojis** estratégicamente (🏆 para lo mejor, 🔥 para destacado, etc.)

Responde SOLO con el análisis formateado, sin introducciones ni despedidas.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // Mejor modelo disponible
      messages: [
        { 
          role: 'system', 
          content: 'Eres un analista experto de datos de Twitter/X. Tu especialidad es encontrar patrones ocultos y dar insights accionables basados en datos reales.' 
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3, // Baja para análisis preciso basado en datos
      max_tokens: 2500,
    });

    const analysis = response.choices[0]?.message?.content || '❌ Error generando análisis';

    return analysis;
  } catch (error) {
    console.error('Error analyzing account:', error);
    return `❌ Error analizando la cuenta: ${error instanceof Error ? error.message : 'Error desconocido'}`;
  }
}
