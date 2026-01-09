export default (ctx) => {
  // Check if we should run tailwind
  let runTailwind = true;

  if (!ctx.file) {
    // If no file context, assume we might be processing something where we don't want strict tailwind checks
    // But for source files we usually have ctx.file.
    // Let's try disabling it if no file, assuming source files have it.
    runTailwind = false;
  } else if (
    typeof ctx.file === "string" &&
    ctx.file.includes("node_modules")
  ) {
    runTailwind = false;
  } else if (ctx.file.dirname && ctx.file.dirname.includes("node_modules")) {
    runTailwind = false;
  }

  return {
    plugins: {
      "postcss-import": {},
      tailwindcss: runTailwind ? {} : false,
      autoprefixer: {},
    },
  };
};
