const { MercadoPagoConfig, Preference } = require('mercadopago');
async function test() {
  const client = new MercadoPagoConfig({ accessToken: 'APP_USR-8992224252602010-100416-a7b9e4854307f57d3e29bd7183f66b98-3737970660' });
  const preference = new Preference(client);
  const url = "https://unbeaten-pediatric-collector.ngrok-free.dev\r";
  try {
    const res = await preference.create({
      body: {
        items: [{ id: '1', title: 'test', quantity: 1, unit_price: 100 }],
        auto_return: 'approved',
        back_urls: {
          success: url + '/carrito/success',
          failure: url + '/carrito/failure',
          pending: url + '/carrito/pending'
        }
      }
    });
    console.log("SUCCESS!", res.init_point);
  } catch (err) {
    console.error("ERROR!", err.message, err.cause);
  }
}
test();
