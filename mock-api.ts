globalThis.fetch = async (url, options) => {
  if (url !== 'https://api.openai.com/v1/audio/transcriptions' || options.body.get('model') !== 'gpt-transcribe' || !(options.body.get('file') instanceof Blob) || options.body.get('languages[]') !== 'zh-tw') throw new Error('Unexpected request');
  return Response.json({ text: '你好世界', languages: [{ code: 'zh-tw' }] });
};
