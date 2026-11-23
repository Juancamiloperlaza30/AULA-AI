import {
  consultarMisComunicados,
} from './comunicadoService';

import {
  guardarComunicadosOffline,
} from '../database/communicationsOfflineDatabase';

const LIMITE_PAGINA = 20;
const VIGENCIA_MS = 60 * 1000;

const precargasEnCurso = new Map();
const precargasRecientes = new Map();

const validarPagina = (resultado, paginaEsperada) => {
  const paginacion = resultado?.paginacion;
  const pagina = Number(paginacion?.pagina);
  const limite = Number(paginacion?.limite);
  const total = Number(paginacion?.total);
  const totalPaginas = Number(
    paginacion?.totalPaginas
  );

  if (
    !Array.isArray(resultado?.comunicados) ||
    pagina !== paginaEsperada ||
    limite !== LIMITE_PAGINA ||
    !Number.isSafeInteger(total) ||
    total < 0 ||
    !Number.isSafeInteger(totalPaginas) ||
    totalPaginas !== Math.ceil(total / limite)
  ) {
    throw new Error(
      'La respuesta paginada de comunicados no es válida.'
    );
  }

  return {
    total,
    totalPaginas,
  };
};

const descargarComunicados = async ({
  apiUrl,
  accessToken,
}) => {
  const todosLosComunicados = [];
  let totalEsperado = null;
  let totalPaginasEsperado = null;

  for (let pagina = 1; ; pagina += 1) {
    const resultado = await consultarMisComunicados({
      apiUrl,
      accessToken,
      pagina,
      limite: LIMITE_PAGINA,
    });

    const { total, totalPaginas } = validarPagina(
      resultado,
      pagina
    );

    if (totalEsperado == null) {
      totalEsperado = total;
      totalPaginasEsperado = totalPaginas;
    } else if (
      total !== totalEsperado ||
      totalPaginas !== totalPaginasEsperado
    ) {
      throw new Error(
        'La paginación de comunicados cambió durante la sincronización.'
      );
    }

    if (pagina === 1 && totalPaginas === 0) {
      break;
    }

    if (
      totalPaginas === 0 ||
      resultado.comunicados.length === 0
    ) {
      throw new Error(
        'La respuesta paginada de comunicados está incompleta.'
      );
    }

    todosLosComunicados.push(
      ...resultado.comunicados
    );

    if (pagina >= totalPaginas) {
      break;
    }
  }

  const comunicadosUnicos = Array.from(
    new Map(
      todosLosComunicados
        .filter((item) => item?.id != null)
        .map((item) => [String(item.id), item])
    ).values()
  );

  if (comunicadosUnicos.length !== totalEsperado) {
    throw new Error(
      'La cantidad de comunicados recibidos no coincide con la paginación informada.'
    );
  }

  return {
    comunicados: comunicadosUnicos,
    totalPaginas: totalPaginasEsperado,
  };
};

export const precargarComunicadosEstudiante =
  async ({ usuarioId, apiUrl, accessToken }) => {
    const id = String(usuarioId ?? '').trim();

    if (!id || !apiUrl || !accessToken) {
      return null;
    }

    const reciente = precargasRecientes.get(id);

    if (
      reciente &&
      Date.now() - reciente.creadoEn < VIGENCIA_MS
    ) {
      return reciente.resultado;
    }

    const enCurso = precargasEnCurso.get(id);

    if (enCurso) {
      return enCurso;
    }

    let tarea;

    tarea = (async () => {
      try {
        const descarga = await descargarComunicados({
          apiUrl,
          accessToken,
        });

        const sincronizadoEn =
          await guardarComunicadosOffline({
            usuarioId: id,
            comunicados: descarga.comunicados,
          });

        const resultado = {
          comunicados: descarga.comunicados,
          sincronizadoEn,
          totalPaginas: descarga.totalPaginas,
        };

        precargasRecientes.set(id, {
          creadoEn: Date.now(),
          resultado,
        });

        return resultado;
      } finally {
        if (precargasEnCurso.get(id) === tarea) {
          precargasEnCurso.delete(id);
        }
      }
    })();

    precargasEnCurso.set(id, tarea);
    return tarea;
  };
