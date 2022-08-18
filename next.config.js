module.exports = {
    webpack: (config) => {
  
      // Since Webpack 5 doesn't enable WebAssembly by default, we should do it manually
      config.experiments = { 
        asyncWebAssembly: true,
        topLevelAwait: true,
        layers: true,
	    }
  
      return config
    },
    output: 'standalone',
    env: {
        COSMOS_KEY: '-',
        COSMOS_ENDPOINT: '-',
        COSMOS_DATABASE: '-',
        CLIENT_ID: '-',
        CLIENT_SECRET: '-',
        APP_URI: '-',
        JWT_SECRET: '-',
        WALLET_PRIV_KEY: '-',
        WALLET_ADDRESS: '-'            
    },
  };
