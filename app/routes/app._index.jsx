import { useEffect, useState } from "react";
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
import '../css/main.css'

export default function Index() {
  // const [padding, setPadding] = useState(({
  //   paddingLeft: '10rem',
  //   paddingRight: '1rem'
  // }))

  // useEffect(() => {

  //   const width = window.innerWidth
  //   window.addEventListener("resize", () => {
  //     if (width < 1200) {
  //       setPadding({
  //         paddingLeft: '10rem',
  //         paddingRight: '1rem'
  //       })
  //     } else {
  //       setPadding({
  //         paddingLeft: '15rem',
  //         paddingRight: '3rem'
  //       })
  //     }
  //   });
  //   return () => {
  //     window.removeEventListener("resize", () => {});
  //   }
  // }, [])

  return (
    <Page fullWidth>

      <Placeholder
        component={
          <ProductsAndOrdersSync />
        }
        className="main-component"
        marginTop='0'
        paddingTop='70px'
        paddingBottom='30px'
        // paddingLeft={padding.paddingLeft}
        // paddingRight={padding.paddingRight}
        itemsCentered
      />

    </Page>
  );
}
