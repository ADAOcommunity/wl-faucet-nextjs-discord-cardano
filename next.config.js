module.exports = {
    webpack: (config) => {
  
      // Since Webpack 5 doesn't enable WebAssembly by default, we should do it manually
      config.experiments = { asyncWebAssembly: true, layers: true }
  
      return config
    }
  };