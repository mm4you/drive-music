const CLOUDFLARE_WORKERS_STUB =
  "data:text/javascript,export const env = Object.create(null);";

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "cloudflare:workers") {
    return {
      url: CLOUDFLARE_WORKERS_STUB,
      shortCircuit: true,
    };
  }

  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (specifier.includes("?")) {
      const cleanSpecifier = specifier.split("?")[0];
      return nextResolve(cleanSpecifier, context);
    }
    throw err;
  }
}

