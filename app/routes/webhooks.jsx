import { authenticate } from "../shopify.server";
import db from "../db.server";
import updateKickscrewProducts from "../apis/updateKickscrewProducts";

export const action = async ({ request }) => {
  const { topic, shop, session, admin, payload } = await authenticate.webhook(request);

  if (!admin && topic !== "SHOP_REDACT") {
    // The admin context isn't returned if the webhook fired after a shop was uninstalled.
    // The SHOP_REDACT webhook will be fired up to 48 hours after a shop uninstalls the app.
    // Because of this, no admin context is available.
    throw new Response();
  }

  // The topics handled here should be declared in the shopify.app.toml.
  // More info: https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration
  switch (topic) {
    case "APP_UNINSTALLED":
      if (session) {
        await db.session.deleteMany({ where: { shop } });
      }

      break;
    case "CUSTOMERS_DATA_REQUEST":
    case "CUSTOMERS_REDACT":
    case "SHOP_REDACT":
    case "PRODUCTS_UPDATE":
      console.log("payload of PRODUCTS_UPDATE ", payload);
      return "test"

      // await Promise.all(payload?.variants.map(async (variant) => {
      try {
        let productTag;
        const api_key = process.env.crewsupply_api_key;
        // const regex = /kickscrew-(\S+)/;
        const regex = /kickscrew-(\S+?)(?:,|\s|$)/;
        const match = payload?.tags?.match(regex);
        if (match) {
          // console.log("match",match);
          productTag = match[1];
          // console.log("productTag ",productTag);
        } else {
          console.log('No match found for tag');
        }

        if (productTag) {

          const updatedProductDataRes = await updateKickscrewProducts(payload?.variants, productTag, api_key)

          console.log(" updatedProductDataRes.........    ", updatedProductDataRes);
          
        } else {
          console.log("productTag not found in the payload matching 'kickscrew-' ", productTag);
        }


      } catch (error) {
        console.log("error occured on product update", error);
      }
      // }))

      break;


    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }

  throw new Response();
};
