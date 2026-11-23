'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const {
  recibirSoporteExcusa,
} = require('../src/middleware/excuseUploadMiddleware');

async function iniciarServidor() {
  const app = express();

  app.post(
    '/soporte',
    recibirSoporteExcusa,
    (req, res) => res.status(200).json({
      success: true,
      mime: req.soporteValidado.mime,
      extension: req.soporteValidado.extension,
    })
  );

  const servidor = app.listen(0, '127.0.0.1');

  await new Promise((resolve, reject) => {
    servidor.once('listening', resolve);
    servidor.once('error', reject);
  });

  return {
    servidor,
    url: `http://127.0.0.1:${servidor.address().port}/soporte`,
  };
}

async function enviarArchivo(
  contenido,
  mime,
  nombre = 'soporte'
) {
  const { servidor, url } = await iniciarServidor();

  try {
    const formulario = new FormData();
    formulario.append(
      'soporte',
      new Blob([contenido], { type: mime }),
      nombre
    );

    const respuesta = await fetch(url, {
      method: 'POST',
      body: formulario,
    });

    return {
      status: respuesta.status,
      body: await respuesta.json(),
    };
  } finally {
    await new Promise((resolve) =>
      servidor.close(resolve)
    );
  }
}

test('RNF-09.5: acepta archivos permitidos cuya firma coincide con su MIME', async () => {
  const respuesta = await enviarArchivo(
    Buffer.from([
      0x89, 0x50, 0x4e, 0x47,
      0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x00,
    ]),
    'image/png',
    'evidencia.png'
  );

  assert.equal(respuesta.status, 200);
  assert.equal(respuesta.body.mime, 'image/png');
  assert.equal(respuesta.body.extension, 'png');
});

test('RNF-09.5: rechaza archivos cuya firma no coincide con su MIME', async () => {
  const respuesta = await enviarArchivo(
    Buffer.from('%PDF-1.7 soporte'),
    'image/jpeg',
    'evidencia.jpg'
  );

  assert.equal(respuesta.status, 400);
  assert.equal(respuesta.body.success, false);
  assert.match(respuesta.body.message, /no coincide/i);
});

test('RNF-09.5: rechaza soportes mayores a 5 MB', async () => {
  const respuesta = await enviarArchivo(
    Buffer.alloc(5 * 1024 * 1024 + 1, 0x41),
    'application/pdf',
    'evidencia.pdf'
  );

  assert.equal(respuesta.status, 413);
  assert.equal(respuesta.body.success, false);
  assert.match(respuesta.body.message, /5 MB/);
});
