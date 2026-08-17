function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const PROMPT = `この写真に写っている料理を見て、レシピを推測してください。
実際に写真から読み取れる内容と、一般的なレシピ知識から妥当な内容を組み合わせて構いません。
日本語で、指定したJSON形式のみを出力してください。分量が分からない材料は amount と unit を空文字にしてください。
調理時間が分からない場合は cookingMinutes を null にしてください。`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          amount: { type: 'string' },
          unit: { type: 'string' },
        },
        required: ['name', 'amount', 'unit'],
      },
    },
    steps: { type: 'array', items: { type: 'string' } },
    cookingMinutes: { type: 'integer', nullable: true },
  },
  required: ['title', 'ingredients', 'steps'],
};

export async function guessRecipeFromPhoto(photoBlob, apiKey, model) {
  const base64 = await blobToBase64(photoBlob);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [{
      parts: [
        { text: PROMPT },
        { inline_data: { mime_type: photoBlob.type || 'image/jpeg', data: base64 } },
      ],
    }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Gemini API error (${res.status}): ${errBody.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini APIから応答が得られませんでした');

  const parsed = JSON.parse(text);
  return {
    title: parsed.title || '',
    ingredients: (parsed.ingredients || []).map((i) => ({
      name: i.name || '', amount: i.amount || '', unit: i.unit || '',
    })),
    steps: parsed.steps || [],
    cookingMinutes: typeof parsed.cookingMinutes === 'number' ? parsed.cookingMinutes : null,
  };
}
