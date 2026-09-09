const baseUrl = process.env.AURIA_TEST_URL || 'http://127.0.0.1:3101';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const bootstrapResponse = await fetch(`${baseUrl}/api/public/bootstrap`);
assert(bootstrapResponse.status === 200, `public bootstrap returned ${bootstrapResponse.status}`);

const bootstrap = await bootstrapResponse.json();
const pdfUrl = bootstrap?.resume?.pdf_url;
assert(typeof pdfUrl === 'string' && pdfUrl.length > 0, 'public resume has no PDF URL');

const pdfResponse = await fetch(new URL(pdfUrl, baseUrl), { method: 'HEAD' });
const contentType = pdfResponse.headers.get('content-type') || '';
const frameOptions = pdfResponse.headers.get('x-frame-options');

assert(pdfResponse.status === 200, `PDF returned ${pdfResponse.status}`);
assert(contentType.toLowerCase().startsWith('application/pdf'), `unexpected PDF content type: ${contentType}`);
assert(frameOptions?.toUpperCase() !== 'DENY', 'PDF response forbids iframe embedding with X-Frame-Options: DENY');

console.log(JSON.stringify({
  pdf_url: pdfUrl,
  status: pdfResponse.status,
  content_type: contentType,
  x_frame_options: frameOptions,
  iframe_embedding: 'passed',
}, null, 2));
