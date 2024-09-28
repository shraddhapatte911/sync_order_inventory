import { useEffect } from "react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  Box,
  List,
  Link,
  InlineStack,
} from "@shopify/polaris";
import Placeholder from "../components/Placeholder";
import ProductsAndOrdersSync from "../components/SyncComponents/ProductsAndOrdersSync";

export default function Index() {


  return (
    <Page fullWidth>

      <Placeholder
        component={
          <ProductsAndOrdersSync />
        }
        marginTop='0'
        paddingTop='70px'
        paddingBottom='30px'
        paddingLeft="15rem"
        paddingRight="3rem"
        itemsCentered
      />

    </Page>
  );
}
