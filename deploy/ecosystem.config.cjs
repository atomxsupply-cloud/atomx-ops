module.exports = {
  apps: [
    {
      name: 'atomx-ops',
      cwd: '/var/www/atomx-ops/backend',
      script: 'src/index.js',
      interpreter: 'node',
      interpreter_args: '--experimental-sqlite',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },
  ],
};
