export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/worker-test') {
      return new Response('Worker v2 OK - deploy funcionando', { status: 200 });
    }

    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'no-store, no-cache');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
