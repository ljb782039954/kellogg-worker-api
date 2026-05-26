var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-77xaZa/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// src/utils/response.ts
function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.CORS_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Range",
    "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges",
    "Access-Control-Max-Age": "86400"
  };
}
__name(corsHeaders, "corsHeaders");
function transformMediaUrls(data, request) {
  if (!data || !request)
    return data;
  const prodAssetsUrl = "https://assets.kelloggfashion.com";
  const url = new URL(request.url);
  const host = `${url.protocol}//${url.host}`;
  if (!(host.includes("localhost") || host.includes("127.0.0.1"))) {
    return data;
  }
  const transform = /* @__PURE__ */ __name((val) => {
    if (typeof val === "string") {
      if (val.includes(prodAssetsUrl)) {
        return val.replaceAll(prodAssetsUrl, host);
      }
      return val;
    }
    if (Array.isArray(val))
      return val.map(transform);
    if (val !== null && typeof val === "object") {
      const res = {};
      for (const k in val)
        res[k] = transform(val[k]);
      return res;
    }
    return val;
  }, "transform");
  return transform(data);
}
__name(transformMediaUrls, "transformMediaUrls");
function jsonResponse(data, env, status = 200, request) {
  const finalData = request ? transformMediaUrls(data, request) : data;
  return new Response(JSON.stringify(finalData), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
      ...corsHeaders(env)
    }
  });
}
__name(jsonResponse, "jsonResponse");
function errorResponse(message, env, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(env)
    }
  });
}
__name(errorResponse, "errorResponse");
function optionsResponse(env) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(env)
  });
}
__name(optionsResponse, "optionsResponse");
function paginatedResponse(data, page, pageSize, total, env, request) {
  const response = {
    data: request ? transformMediaUrls(data, request) : data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    }
  };
  return jsonResponse(response, env);
}
__name(paginatedResponse, "paginatedResponse");

// src/tasks/exchangeRates.ts
async function fetchExchangeRates(env) {
  if (!env.EXCHANGE_RATE_API_KEY) {
    console.warn("[ExchangeRates] EXCHANGE_RATE_API_KEY is not set. Skipping sync.");
    return;
  }
  const baseCurrency = "CNY";
  const apiUrl = `https://v6.exchangerate-api.com/v6/${env.EXCHANGE_RATE_API_KEY}/latest/${baseCurrency}`;
  try {
    console.log(`[ExchangeRates] Fetching latest rates for base: ${baseCurrency}...`);
    const response = await fetch(apiUrl);
    if (!response.ok) {
      console.error(`[ExchangeRates] Failed to fetch. Status: ${response.status}`);
      const text = await response.text();
      console.error(`[ExchangeRates] Response text: ${text}`);
      return;
    }
    const data = await response.json();
    if (data.result === "success" && data.conversion_rates) {
      const ratesData = {
        base: data.base_code || baseCurrency,
        rates: data.conversion_rates,
        last_updated: data.time_last_update_utc || (/* @__PURE__ */ new Date()).toISOString()
      };
      await env.KELLOGG_FRONTEND_CONFIG.put("exchangeRates", JSON.stringify(ratesData));
      console.log(`[ExchangeRates] Successfully updated exchange rates in KV. Base: ${ratesData.base}`);
    } else {
      console.error("[ExchangeRates] Invalid data format returned from API", data);
    }
  } catch (error) {
    console.error("[ExchangeRates] Error while fetching exchange rates:", error);
  }
}
__name(fetchExchangeRates, "fetchExchangeRates");

// src/utils/auth.ts
function verifyAdminToken(request, env) {
  if (!env.ADMIN_TOKEN) {
    return null;
  }
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return errorResponse("\u672A\u63D0\u4F9B\u8BA4\u8BC1\u4EE4\u724C", env, 401);
  }
  const token = authHeader.replace("Bearer ", "");
  if (token !== env.ADMIN_TOKEN) {
    return errorResponse("\u8BA4\u8BC1\u4EE4\u724C\u65E0\u6548", env, 401);
  }
  return null;
}
__name(verifyAdminToken, "verifyAdminToken");

// src/utils/transform.ts
function buildImageUrl(baseUrl, imageKey) {
  if (!imageKey)
    return "";
  if (imageKey.startsWith("http"))
    return imageKey;
  return `${baseUrl}/${imageKey}`;
}
__name(buildImageUrl, "buildImageUrl");
function transformProduct(row, images, sizes, colors, customFields, videos, baseUrl) {
  const productImages = images.filter((img) => img.product_id === row.id).sort((a, b) => a.sort_order - b.sort_order).map((img) => buildImageUrl(baseUrl, img.image_key));
  return {
    id: row.id,
    name: { zh: row.name_zh, en: row.name_en },
    price: row.price,
    originalPrice: row.original_price ?? void 0,
    bulkPrices: row.bulk_prices ? JSON.parse(row.bulk_prices) : [],
    image: buildImageUrl(baseUrl, row.image),
    images: productImages,
    rating: row.rating,
    sales: row.sales,
    tag: row.tag_zh || row.tag_en ? { zh: row.tag_zh || "", en: row.tag_en || "" } : void 0,
    category: row.category_id ?? void 0,
    releaseDate: row.release_date ?? void 0,
    description: row.description_zh || row.description_en ? { zh: row.description_zh || "", en: row.description_en || "" } : void 0,
    isFeatured: row.is_featured === 1,
    isActive: row.is_active === 1,
    fabric: row.fabric_zh || row.fabric_en ? { zh: row.fabric_zh || "", en: row.fabric_en || "" } : void 0,
    notes: row.notes_zh || row.notes_en ? { zh: row.notes_zh || "", en: row.notes_en || "" } : void 0,
    sizes: sizes.filter((s) => s.product_id === row.id).sort((a, b) => a.sort_order - b.sort_order).map((s) => ({
      name: s.name,
      image: buildImageUrl(baseUrl, s.image)
    })),
    colors: colors.filter((c) => c.product_id === row.id).sort((a, b) => a.sort_order - b.sort_order).map((c) => ({
      name: { zh: c.name_zh, en: c.name_en },
      image: buildImageUrl(baseUrl, c.image)
    })),
    customFields: customFields.filter((cf) => cf.product_id === row.id).sort((a, b) => a.sort_order - b.sort_order).map((cf) => ({
      name: { zh: cf.name_zh, en: cf.name_en },
      value: { zh: cf.value_zh, en: cf.value_en }
    })),
    videos: videos.filter((v) => v.product_id === row.id).sort((a, b) => a.sort_order - b.sort_order).map((v) => v.video_url)
  };
}
__name(transformProduct, "transformProduct");
function transformCategory(row, baseUrl) {
  return {
    id: row.id,
    name: { zh: row.name_zh, en: row.name_en },
    image: baseUrl && row.image ? buildImageUrl(baseUrl, row.image) : row.image || void 0
  };
}
__name(transformCategory, "transformCategory");

// src/jsonData/new_pages/pages_index.json
var pages_index_default = [
  {
    id: "system-inquiry",
    path: "/inquiry",
    title: {
      zh: "\u8BE2\u76D8\u4E0E\u8054\u7CFB\u6211\u4EEC",
      en: "Inquiry & Contact"
    },
    isFixed: true,
    type: "fixed-layout",
    lastModified: "2026-05-09T14:31:25.380Z"
  },
  {
    id: "home",
    path: "/",
    title: {
      zh: "\u9996\u9875",
      en: "Home"
    },
    isFixed: true,
    type: "fixed-block",
    lastModified: "2026-03-24T08:41:09.911Z"
  },
  {
    id: "about",
    path: "/about",
    title: {
      zh: "\u5173\u4E8E\u6211\u4EEC",
      en: "About Us"
    },
    isFixed: true,
    type: "fixed-block",
    lastModified: "2026-03-24T08:41:10.016Z"
  },
  {
    id: "products",
    path: "/products",
    title: {
      zh: "\u5546\u54C1\u5C55\u793A",
      en: "Products"
    },
    isFixed: true,
    type: "fixed-block",
    lastModified: "2026-03-24T08:41:10.016Z"
  },
  {
    id: "faq",
    path: "/faq",
    title: {
      zh: "\u5E38\u89C1\u95EE\u9898",
      en: "FAQ"
    },
    isFixed: true,
    type: "fixed-block",
    lastModified: "2026-03-24T08:41:10.016Z"
  },
  {
    id: "page_a_KYVkin",
    path: "/usa-heavyweight-hoodie-manufacturer",
    title: {
      zh: "USA LandingPage",
      en: "USA LandingPage"
    },
    isFixed: false,
    type: "dynamic-block",
    lastModified: "2026-05-09T14:31:25.409Z"
  },
  {
    id: "page_pSjnlVdS",
    path: "/uk-streetwear-clothing-manufacturer",
    title: {
      zh: "UK LandingPage",
      en: "UK LandingPage"
    },
    isFixed: false,
    type: "dynamic-block",
    lastModified: "2026-05-09T14:31:25.410Z"
  },
  {
    id: "page_eMW226Bg",
    path: "/australia-heavyweight-tshirt-supplier",
    title: {
      zh: "Australia Landing",
      en: "Australia Landing"
    },
    isFixed: false,
    type: "dynamic-block",
    lastModified: "2026-05-09T14:31:25.411Z"
  },
  {
    id: "page_tU08GYe-",
    path: "/canada-blank-apparel-supplier",
    title: {
      zh: "Canada Landing Page",
      en: "Canada Landing Page"
    },
    isFixed: false,
    type: "dynamic-block",
    lastModified: "2026-05-09T14:31:25.411Z"
  },
  {
    id: "page_Pr_ioNLI",
    path: "/fabrics",
    title: {
      zh: "Fabrics",
      en: "Fabrics"
    },
    isFixed: false,
    type: "dynamic-block",
    lastModified: "2026-05-09T14:31:25.411Z"
  },
  {
    id: "page_04nJbSUr",
    path: "/service",
    title: {
      zh: "Clothing development",
      en: "Clothing development"
    },
    isFixed: false,
    type: "dynamic-block",
    lastModified: "2026-05-09T14:31:25.412Z"
  },
  {
    id: "page_dN08AxrE",
    path: "/service2",
    title: {
      zh: "Labels / Tags / Packing",
      en: "Labels / Tags / Packing"
    },
    isFixed: false,
    type: "dynamic-block",
    lastModified: "2026-05-09T14:31:25.445Z"
  },
  {
    id: "page_LqoCA7TD",
    path: "/technology",
    title: {
      zh: "Technology",
      en: "Technology"
    },
    isFixed: false,
    type: "dynamic-block",
    lastModified: "2026-05-09T14:31:25.445Z"
  },
  {
    id: "page_1qt8A_F-",
    path: "/solutions",
    title: {
      zh: "Solutions",
      en: "Solutions"
    },
    isFixed: false,
    type: "dynamic-block"
  },
  {
    id: "page_M4rOqEH6",
    path: "/blog-invalid",
    title: {
      zh: "Blog",
      en: "Blog"
    },
    isFixed: false,
    type: "dynamic-block"
  },
  {
    id: "system-blog",
    path: "/blog",
    title: {
      zh: "\u535A\u5BA2",
      en: "Blog"
    },
    isFixed: true,
    type: "fixed-layout",
    lastModified: "2026-05-20T00:00:00.000Z"
  },
  {
    id: "case-studies",
    path: "/case-studies",
    title: {
      zh: "\u5BA2\u6237\u6848\u4F8B",
      en: "Case Studies"
    },
    isFixed: true,
    type: "fixed-layout",
    lastModified: "2026-05-26T00:00:00.000Z"
  }
];

// src/jsonData/new_pages/page_home.json
var page_home_default = {
  id: "home",
  path: "/",
  title: {
    zh: "\u9996\u9875",
    en: "Home"
  },
  isFixed: true,
  lastModified: "2026-03-24T08:41:09.911Z",
  seo: {
    title: {
      zh: "Heavyweight Hoodie Manufacturer in China | Custom Streetwear Factory | 500-640 GSM Heavyweight Hoodie Manufacturer China | Kellogg Fashion high-quality hoodies",
      en: "Heavyweight Hoodie Manufacturer in China | Custom Streetwear Factory | 500-640 GSM Heavyweight Hoodie Manufacturer China | Kellogg Fashion high-quality hoodies"
    },
    description: {
      zh: "Kellogg Fashion is a professional clothing manufacturer located in Guangdong China, offering custom streetwear production including heavyweight hoodies, oversized T-shirts, and full OEM/ODM services for startup and established brands.",
      en: "Kellogg Fashion is a professional clothing manufacturer located in Guangdong China, offering custom streetwear production including heavyweight hoodies, oversized T-shirts, and full OEM/ODM services for startup and established brands."
    },
    targetCountry: "United States,Canada,United Kingdom,Australia",
    keywords: {
      zh: "500gsm hoodie manufacturer,heavyweight hoodie supplier,oversized hoodie factory,private label streetwear supplier,best hoodie manufacturer for startups,China streetwear factory for DTC brands,custom streetwear supplier,bulk hoodie production China,heavyweight hoodie factory Guangdong",
      en: "500gsm hoodie manufacturer,heavyweight hoodie supplier,oversized hoodie factory,private label streetwear supplier,best hoodie manufacturer for startups,China streetwear factory for DTC brands,custom streetwear supplier,bulk hoodie production China,heavyweight hoodie factory Guangdong"
    }
  },
  blocks: [
    {
      id: "block_w4kWgxHJ",
      type: "carousel",
      isVisible: true,
      content: {
        autoPlay: true,
        interval: 3e3,
        items: [
          {
            id: 1,
            image: "https://assets.kelloggfashion.com/uploads/9_07sSKDZUBkui4BFJ.png",
            title: {
              zh: "From Concept to Premium Garment Production",
              en: "From Concept to Premium Garment Production"
            },
            subtitle: {
              zh: "We manufacture heavyweight streetwear for emerging and established fashion brands worldwide.",
              en: "We manufacture heavyweight streetwear for emerging and established fashion brands worldwide."
            },
            cta: {
              zh: "\u63A2\u7D22\u7CFB\u5217",
              en: "Explore Collection"
            },
            link: {
              id: "l1",
              name: {
                zh: "\u63A2\u7D22\u7CFB\u5217",
                en: "Explore Collection"
              },
              href: "/inquiry",
              linkType: "internal",
              pageDeleted: false
            }
          },
          {
            id: 2,
            image: "https://assets.kelloggfashion.com/uploads/heayweight_hoodis_manufacturer_L7hqjWlfmANHEgUB.jpg",
            title: {
              zh: "Built for Premium Streetwear Production",
              en: "Built for Premium Streetwear Production"
            },
            subtitle: {
              zh: "From sampling to bulk production, our factory supports global streetwear brands with stable quality and fast lead times.",
              en: "From sampling to bulk production, our factory supports global streetwear brands with stable quality and fast lead times."
            },
            cta: {
              zh: "\u7ACB\u5373\u9009\u8D2D",
              en: "Shop Now"
            },
            link: {
              id: "l2",
              name: {
                zh: "\u7ACB\u5373\u9009\u8D2D",
                en: "Shop Now"
              },
              href: "/inquiry",
              linkType: "internal",
              pageDeleted: false
            }
          },
          {
            id: 3,
            image: "https://assets.kelloggfashion.com/uploads/heayweight_hoodis_manufacturer_-2_nn83MWinv0EWNK8q.jpg",
            title: {
              zh: "Premium Details Make the Difference",
              en: "Premium Details Make the Difference"
            },
            subtitle: {
              zh: "Heavyweight fabrics, custom washes, embroidery, and precision finishing designed for modern streetwear brands.",
              en: "Heavyweight fabrics, custom washes, embroidery, and precision finishing designed for modern streetwear brands."
            },
            cta: {
              zh: "\u7ACB\u5373\u884C\u52A8",
              en: "Take Action"
            },
            link: {
              id: "f9lvytrjh",
              name: {
                zh: "\u7ACB\u5373\u884C\u52A8",
                en: "Take Action"
              },
              linkType: "internal",
              href: "/inquiry",
              pageDeleted: false
            }
          }
        ]
      }
    },
    {
      id: "block_zSo0mM9Z",
      type: "textSection",
      isVisible: true,
      content: {
        title: {
          zh: "Heavyweight Hoodie Manufacturer in China (500\u2013600gsm Custom Streetwear Factory), OEM / ODM Oversized Hoodies for Streetwear Brands in USA, UK & Australia",
          en: "Heavyweight Hoodie Manufacturer in China (500\u2013600gsm Custom Streetwear Factory), OEM / ODM Oversized Hoodies for Streetwear Brands in USA, UK & Australia"
        },
        content: {
          zh: "\u2714 10+ Years Manufacturing Experience. \n\u2714 200+ Streetwear Brands Served. \n\u2714 Export to USA / Europe / Australia",
          en: "\u2714 10+ Years Manufacturing Experience. \n\u2714 200+ Streetwear Brands Served. \n\u2714 Export to USA / Europe / Australia"
        },
        alignment: "center",
        paddingY: "medium"
      }
    },
    {
      id: "block_2jSHn838",
      type: "imageText",
      isVisible: true,
      content: {
        title: {
          zh: "Kellogg Fashion is a China-based streetwear manufacturer specializing in heavyweight 500\u2013600gsm hoodies and oversized apparel for global fashion brands.",
          en: "Kellogg Fashion is a China-based streetwear manufacturer specializing in heavyweight 500\u2013600gsm hoodies and oversized apparel for global fashion brands."
        },
        content: {
          zh: "Product Type:Hoodie / Sweatshirt / Streetwear //\nMaterial:French Terry,Fleece,Cotton GSM grading system,Shrink control fabrics //\nGSM Range:400\u2013600gsm //\nMOQ:50\u2013100 pcs //\nLead Time:15\u201325 days //\nProduction Type:OEM / ODM //\nWe have produced for:US streetwear startup brands ,Australian fashion labels ,UK Shopify brands //\nOur advantages:30+ US streetwear brands served,Monthly production: 50,00+ hoodies,Export to 10+ countries",
          en: "Product Type:Hoodie / Sweatshirt / Streetwear //\nMaterial:French Terry,Fleece,Cotton GSM grading system,Shrink control fabrics //\nGSM Range:400\u2013600gsm //\nMOQ:50\u2013100 pcs //\nLead Time:15\u201325 days //\nProduction Type:OEM / ODM //\nWe have produced for:US streetwear startup brands ,Australian fashion labels ,UK Shopify brands //\nOur advantages:30+ US streetwear brands served,Monthly production: 50,00+ hoodies,Export to 10+ countries"
        },
        image: "https://assets.kelloggfashion.com/uploads/158da393-350gsm heavyweight hoodie manufacturer Australia -3.jpg",
        imagePosition: "right",
        buttonText: {
          zh: "Get Free Quote in 24 Hourse",
          en: "Get Free Quote in 24 Hourse"
        },
        buttonLink: "https://wa.me/message/VPTYGENPVZYCL1"
      }
    },
    {
      id: "block_B5DuyG0d",
      type: "featuredProducts",
      isVisible: true,
      content: {
        title: {
          zh: "\u7CBE\u9009\u63A8\u8350",
          en: "Featured Products"
        },
        subtitle: {
          zh: "\u672C\u5B63\u70ED\u95E8\u5355\u54C1",
          en: "This Season's Hot Items"
        },
        maxItems: 8
      }
    },
    {
      id: "block_5cuCLuJj",
      type: "featureList",
      isVisible: true,
      content: {
        title: {
          zh: "Our Core Products",
          en: "Our Core Products"
        },
        features: [],
        columns: 3,
        items: [
          {
            icon: "Star",
            title: {
              zh: "Heavyweight Hoodies (400\u2013640 GSM)",
              en: "Heavyweight Hoodies (400\u2013640 GSM)"
            },
            description: {
              zh: "Our heavyweight hoodies are engineered for premium streetwear brands seeking superior structure, warmth, and durability. Crafted from 100% cotton fleece in 400-600 GSM, each hoodie features oversized silhouettes, drop shoulders, double-layer hoods, and reinforced ribbing.\n\nWe offer full OEM and ODM customization, including puff print, embroidery, screen printing, garment dyeing, acid wash, and private labeling. Perfect for luxury streetwear collections, winter drops, and fashion startups looking for high-margin products.",
              en: "Our heavyweight hoodies are engineered for premium streetwear brands seeking superior structure, warmth, and durability. Crafted from 100% cotton fleece in 400-600 GSM, each hoodie features oversized silhouettes, drop shoulders, double-layer hoods, and reinforced ribbing.\n\nWe offer full OEM and ODM customization, including puff print, embroidery, screen printing, garment dyeing, acid wash, and private labeling. Perfect for luxury streetwear collections, winter drops, and fashion startups looking for high-margin products."
            }
          },
          {
            icon: "Star",
            title: {
              zh: "Oversized T-Shirts",
              en: "Oversized T-Shirts"
            },
            description: {
              zh: "Our oversized T-shirts are produced using 230-300 GSM premium combed cotton for exceptional softness, durability, and print performance. Designed with boxy cuts, dropped shoulders, and relaxed fits, these tees are ideal for modern streetwear brands.\n\nAvailable with acid wash, vintage wash, DTG printing, screen printing, and custom embroidery. Suitable for merchandise, fashion labels, and private-label streetwear collections worldwide.",
              en: "Our oversized T-shirts are produced using 230-300 GSM premium combed cotton for exceptional softness, durability, and print performance. Designed with boxy cuts, dropped shoulders, and relaxed fits, these tees are ideal for modern streetwear brands.\n\nAvailable with acid wash, vintage wash, DTG printing, screen printing, and custom embroidery. Suitable for merchandise, fashion labels, and private-label streetwear collections worldwide."
            }
          },
          {
            icon: "Star",
            title: {
              zh: "Sweatpants & Joggers",
              en: "Sweatpants & Joggers"
            },
            description: {
              zh: "Our premium sweatpants and joggers feature heavyweight 380-500 GSM cotton fleece for superior comfort, structure, and durability. Designed with relaxed fits, wide legs, elastic waistbands, and vintage-washed finishes.\n\nIdeal for streetwear brands, athletic collections, and winter essentials. Custom options include embroidery, screen printing, acid wash, silicone logos, and private label packaging.",
              en: "Our premium sweatpants and joggers feature heavyweight 380-500 GSM cotton fleece for superior comfort, structure, and durability. Designed with relaxed fits, wide legs, elastic waistbands, and vintage-washed finishes.\n\nIdeal for streetwear brands, athletic collections, and winter essentials. Custom options include embroidery, screen printing, acid wash, silicone logos, and private label packaging."
            }
          },
          {
            icon: "Award",
            title: {
              zh: "Blank Streetwear Apparel",
              en: "Blank Streetwear Apparel"
            },
            description: {
              zh: "We manufacture premium blank streetwear essentials including hoodies, T-shirts, sweatpants, shorts, and tracksuits. Designed specifically for screen printers, embroidery studios, fashion startups, and established brands.\n\nWith fabric weights ranging from 230 GSM to 600 GSM, our blank garments deliver outstanding printability, consistent sizing, and luxury-level construction. Low MOQ starts at 100 pieces per style.",
              en: "We manufacture premium blank streetwear essentials including hoodies, T-shirts, sweatpants, shorts, and tracksuits. Designed specifically for screen printers, embroidery studios, fashion startups, and established brands.\n\nWith fabric weights ranging from 230 GSM to 600 GSM, our blank garments deliver outstanding printability, consistent sizing, and luxury-level construction. Low MOQ starts at 100 pieces per style."
            }
          }
        ],
        subtitle: {
          zh: "",
          en: ""
        }
      }
    },
    {
      id: "block_EIOIOuC9",
      type: "gallery",
      isVisible: true,
      content: {
        title: {
          zh: "High Expert -20.5oz-22.5oz / 580-640GSM French Terry heavyweight hoodies",
          en: "High Expert -20.5oz-22.5oz / 580-640GSM French Terry heavyweight hoodies"
        },
        images: [],
        columns: 3,
        subtitle: {
          zh: "This heavyweight oversized hoodie is designed for the US streetwear market, combining premium cotton fabric with bold city skyline graphics. Ideal for fashion brands, retailers, and private label hoodie collections.",
          en: "This heavyweight oversized hoodie is designed for the US streetwear market, combining premium cotton fabric with bold city skyline graphics. Ideal for fashion brands, retailers, and private label hoodie collections."
        },
        items: [
          {
            src: "https://assets.kelloggfashion.com/uploads/84babd19-350gsm heavyweight hoodie manufacturer Australia -1.jpg",
            caption: {
              zh: "Heavyweight hoodie 500-600gsm French Terry, cotton streetwear hoodie with graphic portrait print, custom OEM hoodie manufacturer China",
              en: "Heavyweight hoodie 500-600gsm French Terry, cotton streetwear hoodie with graphic portrait print, custom OEM hoodie manufacturer China"
            }
          },
          {
            src: "https://assets.kelloggfashion.com/uploads/97521a9e-350gsm heavyweight hoodie manufacturer Australia -2.jpg",
            caption: {
              zh: "Custom heavyweight French Terry cotton hoodie with vintage portrait print, streetwear manufacturing supplier hoodie",
              en: "Custom heavyweight French Terry cotton hoodie with vintage portrait print, streetwear manufacturing supplier hoodie"
            }
          },
          {
            src: "https://assets.kelloggfashion.com/uploads/e88d3b97-350gsm heavyweight hoodie manufacturer Australia -4.jpg",
            caption: {
              zh: "Black heavyweight hoodie with portrait graphic print, urban streetwear style pullover sweatshirt",
              en: "Black heavyweight hoodie with portrait graphic print, urban streetwear style pullover sweatshirt"
            }
          }
        ]
      }
    },
    {
      id: "block_-RII1TRk",
      type: "gallery",
      isVisible: true,
      content: {
        title: {
          zh: "Heavyweight Blank Crewneck Sweatshirt \u2013 (15.8oz-17.5oz/450-500GSM)",
          en: "Heavyweight Blank Crewneck Sweatshirt \u2013 (15.8oz-17.5oz/450-500GSM)"
        },
        images: [],
        columns: 3,
        subtitle: {
          zh: "Minimalist heavyweight crewneck sweatshirt designed for custom streetwear production, ideal for branding and private label.",
          en: "Minimalist heavyweight crewneck sweatshirt designed for custom streetwear production, ideal for branding and private label."
        },
        items: [
          {
            src: "https://assets.kelloggfashion.com/uploads/39ce5a69-450gms heavyweight hoodies usa-6.jpg",
            caption: {
              zh: "Custom heavyweight cotton hoodie with vintage portrait print, streetwear manufacturing supplier hoodie",
              en: "Custom heavyweight cotton hoodie with vintage portrait print, streetwear manufacturing supplier hoodie"
            }
          },
          {
            src: "https://assets.kelloggfashion.com/uploads/498532a1-450gms heavyweight hoodies usa-7.jpg",
            caption: {
              zh: "Heavyweight hoodie 500gsm, cotton streetwear hoodie with graphic portrait print, custom OEM hoodie manufacturer China",
              en: "Heavyweight hoodie 500gsm, cotton streetwear hoodie with graphic portrait print, custom OEM hoodie manufacturer China"
            }
          },
          {
            src: "https://assets.kelloggfashion.com/uploads/b542657c-450gms heavyweight hoodies usa-8.jpg",
            caption: {
              zh: "Black heavyweight hoodie with portrait graphic print, urban streetwear style pullover sweatshirt",
              en: "Black heavyweight hoodie with portrait graphic print, urban streetwear style pullover sweatshirt"
            }
          }
        ]
      }
    },
    {
      id: "block_cmtlA62d",
      type: "gallery",
      isVisible: true,
      content: {
        title: {
          zh: "Heavyweight T-Shirt Manufacturer | 240GSM 300GSM 380GSM Custom Combed Cotton Tees",
          en: "Heavyweight T-Shirt Manufacturer | 240GSM 300GSM 380GSM Custom Combed Cotton Tees"
        },
        images: [],
        columns: 3,
        subtitle: {
          zh: "Leading heavyweight t-shirt manufacturer in China. 240\u2013380gsm thick cotton t-shirts, oversized fits, and custom streetwear production. Low MOQ, fast sampling, export to USA & Europe.",
          en: "Leading heavyweight t-shirt manufacturer in China. 240\u2013380gsm thick cotton t-shirts, oversized fits, and custom streetwear production. Low MOQ, fast sampling, export to USA & Europe."
        },
        items: [
          {
            src: "https://assets.kelloggfashion.com/uploads/13dfb3b0-heavyweight-black-tee-mockup-1.jpg",
            caption: {
              zh: "heavyweight t shirt 240gsm",
              en: "heavyweight t shirt 240gsm"
            }
          },
          {
            src: "https://assets.kelloggfashion.com/uploads/900542ba-heavyweight-mens-tee-mockup-3.jpg",
            caption: {
              zh: "380gsm heavy weight blank t shirts",
              en: "380gsm heavy weight blank t shirts"
            }
          },
          {
            src: "https://assets.kelloggfashion.com/uploads/c990c544-heavyweight-mens-tee-mockup-2.jpg",
            caption: {
              zh: "300gsm heavyweight t-shirt manufacturer for streetwear brands",
              en: "300gsm heavyweight t-shirt manufacturer for streetwear brands"
            }
          }
        ]
      }
    },
    {
      id: "block_QaRCxBz6",
      type: "featureList",
      isVisible: true,
      content: {
        title: {
          zh: "Why 500\u2013600gsm Hoodies Are the New Streetwear Standard?",
          en: "Why 500\u2013600gsm Hoodies Are the New Streetwear Standard?"
        },
        features: [],
        columns: 3,
        items: [
          {
            icon: "Star",
            title: {
              zh: "The Shift Toward Premium Streetwear Identity",
              en: "The Shift Toward Premium Streetwear Identity"
            },
            description: {
              zh: "Streetwear is no longer just casual clothing\u2014it has become a form of brand identity and cultural expression. In this shift, heavier hoodies (500\u2013600gsm) are increasingly seen as a symbol of premium positioning. Brands use fabric weight as a visible and tactile signal of quality, allowing them to differentiate from mass-market fast fashion. A heavier hoodie immediately communicates \u201Cluxury streetwear\u201D rather than basic apparel.",
              en: "Streetwear is no longer just casual clothing\u2014it has become a form of brand identity and cultural expression. In this shift, heavier hoodies (500\u2013600gsm) are increasingly seen as a symbol of premium positioning. Brands use fabric weight as a visible and tactile signal of quality, allowing them to differentiate from mass-market fast fashion. A heavier hoodie immediately communicates \u201Cluxury streetwear\u201D rather than basic apparel."
            }
          },
          {
            icon: "Star",
            title: {
              zh: "Superior Structure and Silhouette Appeal",
              en: "Superior Structure and Silhouette Appeal"
            },
            description: {
              zh: "One of the main reasons 500\u2013600gsm hoodies are becoming standard is their ability to hold shape. Lighter hoodies often collapse or lose structure after washing, while heavyweight fabrics maintain a boxy, oversized silhouette that is highly desirable in modern streetwear. This structured fit enhances drop-shoulder designs and creates a more architectural look, which aligns with the aesthetic preferences of brands in the US, UK, and Australian markets.",
              en: "One of the main reasons 500\u2013600gsm hoodies are becoming standard is their ability to hold shape. Lighter hoodies often collapse or lose structure after washing, while heavyweight fabrics maintain a boxy, oversized silhouette that is highly desirable in modern streetwear. This structured fit enhances drop-shoulder designs and creates a more architectural look, which aligns with the aesthetic preferences of brands in the US, UK, and Australian markets."
            }
          },
          {
            icon: "Star",
            title: {
              zh: "Durability and Long-Term Wear Value",
              en: "Durability and Long-Term Wear Value"
            },
            description: {
              zh: "Heavyweight hoodies offer significantly improved durability. The denser fabric resists pilling, stretching, and shrinkage, making the garment last longer even under frequent wear. For consumers, this translates into better value per wear; for brands, it reduces quality complaints and strengthens customer satisfaction. In a market where sustainability and longevity are increasingly important, 500\u2013600gsm fabrics align well with both performance and ethical consumption trends.",
              en: "Heavyweight hoodies offer significantly improved durability. The denser fabric resists pilling, stretching, and shrinkage, making the garment last longer even under frequent wear. For consumers, this translates into better value per wear; for brands, it reduces quality complaints and strengthens customer satisfaction. In a market where sustainability and longevity are increasingly important, 500\u2013600gsm fabrics align well with both performance and ethical consumption trends."
            }
          },
          {
            icon: "Star",
            title: {
              zh: "Brand Positioning and Higher Retail Margins",
              en: "Brand Positioning and Higher Retail Margins"
            },
            description: {
              zh: "From a business perspective, heavier hoodies allow brands to justify higher retail prices. A 500\u2013600gsm hoodie is often positioned as a \u201Cpremium drop\u201D product, enabling stronger profit margins compared to standard-weight garments. This also supports limited-edition releases and streetwear \u201Cdrop culture,\u201D where perceived scarcity and quality drive demand. As a result, heavyweight hoodies have become a strategic product category for emerging and established streetwear brands aiming to scale profitably.",
              en: "From a business perspective, heavier hoodies allow brands to justify higher retail prices. A 500\u2013600gsm hoodie is often positioned as a \u201Cpremium drop\u201D product, enabling stronger profit margins compared to standard-weight garments. This also supports limited-edition releases and streetwear \u201Cdrop culture,\u201D where perceived scarcity and quality drive demand. As a result, heavyweight hoodies have become a strategic product category for emerging and established streetwear brands aiming to scale profitably."
            }
          }
        ],
        subtitle: {
          zh: "500\u2013600gsm hoodies are becoming the new streetwear standard for premium brands. Discover why heavyweight hoodies offer better structure, durability, and brand value for modern streetwear labels in the USA, UK, and Australia.",
          en: "500\u2013600gsm hoodies are becoming the new streetwear standard for premium brands. Discover why heavyweight hoodies offer better structure, durability, and brand value for modern streetwear labels in the USA, UK, and Australia."
        }
      }
    },
    {
      id: "block_MMk2VxFk",
      type: "brandValues",
      isVisible: true,
      content: {
        title: {
          zh: "Brand Values",
          en: "Brand Values"
        },
        subtitle: {
          zh: "What We Stand For",
          en: "What We Stand For"
        },
        items: [
          {
            id: 1,
            icon: "Award",
            title: {
              zh: "Heavyweight Manufacturing Expertise",
              en: "Heavyweight Manufacturing Expertise"
            },
            description: {
              zh: "Kellogg Fashion specialises in premium heavyweight hoodies, sweatshirts, and streetwear essentials. Our core fabric range spans from 420GSM to 640GSM, including 500GSM, 580GSM, and 640GSM fleece\u2014weights trusted by leading streetwear brands worldwide. Each garment is engineered for superior structure, long-lasting durability, and the oversized fit demanded by today's premium apparel market.",
              en: "Kellogg Fashion specialises in premium heavyweight hoodies, sweatshirts, and streetwear essentials. Our core fabric range spans from 420GSM to 640GSM, including 500GSM, 580GSM, and 640GSM fleece\u2014weights trusted by leading streetwear brands worldwide. Each garment is engineered for superior structure, long-lasting durability, and the oversized fit demanded by today's premium apparel market."
            }
          },
          {
            id: 2,
            icon: "Award",
            title: {
              zh: "Full Customisation from Concept to Production",
              en: "Full Customisation from Concept to Production"
            },
            description: {
              zh: "We provide end-to-end OEM and private label manufacturing services tailored to your brand. From custom fabric development and pattern making to puff printing, embroidery, chenille, garment dyeing, acid washing, and branded packaging, every detail is built around your vision. Your products are manufactured exclusively for your market\u2014not pulled from a standard catalogue.",
              en: "We provide end-to-end OEM and private label manufacturing services tailored to your brand. From custom fabric development and pattern making to puff printing, embroidery, chenille, garment dyeing, acid washing, and branded packaging, every detail is built around your vision. Your products are manufactured exclusively for your market\u2014not pulled from a standard catalogue."
            }
          },
          {
            id: 3,
            icon: "Award",
            title: {
              zh: "Scalable Production with Low Minimums",
              en: "Scalable Production with Low Minimums"
            },
            description: {
              zh: "Whether you are launching your first collection or scaling an established label, flexibility matters. Our MOQ starts at just 100 pieces per colour per style, while our monthly production capacity exceeds 100,000 garments. This allows startups, e-commerce brands, wholesalers, and established retailers to grow efficiently without sacrificing quality or speed.",
              en: "Whether you are launching your first collection or scaling an established label, flexibility matters. Our MOQ starts at just 100 pieces per colour per style, while our monthly production capacity exceeds 100,000 garments. This allows startups, e-commerce brands, wholesalers, and established retailers to grow efficiently without sacrificing quality or speed."
            }
          },
          {
            id: 4,
            icon: "Award",
            title: {
              zh: "Reliable Global Delivery and Consistent Quality",
              en: "Reliable Global Delivery and Consistent Quality"
            },
            description: {
              zh: "Kellogg Fashion serves apparel brands across North America, Europe, Australia, and emerging global markets. Every order follows strict AQL 2.5 quality control standards, with standard production completed in 20\u201330 days. Our international logistics network ensures fast, secure delivery, helping brands reduce lead times, improve inventory turnover, and scale with confidence worldwide.",
              en: "Kellogg Fashion serves apparel brands across North America, Europe, Australia, and emerging global markets. Every order follows strict AQL 2.5 quality control standards, with standard production completed in 20\u201330 days. Our international logistics network ensures fast, secure delivery, helping brands reduce lead times, improve inventory turnover, and scale with confidence worldwide."
            }
          }
        ]
      }
    },
    {
      id: "block_jB_EcHxl",
      type: "statistics",
      isVisible: true,
      content: {
        title: {
          zh: "\u6211\u4EEC\u7684\u6210\u5C31",
          en: "Our Achievements"
        },
        subtitle: {
          zh: "\u6211\u4EEC\u7684\u6210\u957F\u5386\u7A0B",
          en: "Our Growth Journey"
        },
        items: [
          {
            id: 1,
            value: "10+",
            label: {
              zh: "\u5E74\u884C\u4E1A\u7ECF\u9A8C",
              en: "Years Experience"
            }
          },
          {
            id: 2,
            value: "5K+",
            label: {
              zh: "\u6EE1\u610F\u5BA2\u6237",
              en: "Happy Customers"
            }
          },
          {
            id: 3,
            value: "500K+",
            label: {
              zh: "\u6BCF\u5E74\u51FA\u8D27\u91CF",
              en: "Annual Shipment"
            }
          }
        ]
      }
    },
    {
      id: "block_vu3wJoLM",
      type: "testimonials",
      isVisible: true,
      content: {
        title: {
          zh: "",
          en: "Customer Feedback"
        },
        subtitle: {
          zh: "",
          en: "What They Say About Us"
        },
        maxItems: 3,
        items: [
          {
            id: 1,
            name: {
              zh: "",
              en: "Alexandra Morley"
            },
            role: {
              zh: "",
              en: "Sourcing Manager"
            },
            content: {
              zh: "",
              en: "I am a purchasing manager for a Chinese supply chain. I first came across Google by chance. At first, I wasn't too sure if Kellogg could produce high-quality sweatshirts, especially those with more than 600 grams of fabric, because our company's style requires printing, embroidery, and even washing. To my surprise, they managed to do it, and at the same price point, the goods they delivered to us were of much better quality than those from other suppliers. I'm very glad to have met them and I will continue to work with them."
            },
            avatar: "https://i.pravatar.cc/150?u=1"
          },
          {
            id: 2,
            name: {
              zh: "",
              en: "Noel Mack"
            },
            role: {
              zh: "",
              en: "Buyer Manager"
            },
            content: {
              zh: "",
              en: "I have been collaborating with them for two years. Although their company is still relatively young, they have excellent quality control. For instance, their ability to analyze the understanding of heavyweight sweatshirts is something I greatly admire. Once, one of our company's products used a blend of polyester and cotton. The size of the sample was a little too small. However, the pre-production samples, the shipping samples, and even the final production goods were all handled very well by them. I discussed with them how they managed to do this. They said the size was a bit small because the fabric's shrinkage rate was unstable. Without asking me to increase the price, they washed the fabric to control the shrinkage rate, thus solving a big problem for me. In the future, I will continue to collaborate with them!"
            },
            avatar: "https://i.pravatar.cc/150?u=2"
          },
          {
            id: 3,
            name: {
              zh: "",
              en: "Jeff Cornel"
            },
            role: {
              zh: "",
              en: "Senior Designer"
            },
            content: {
              zh: "",
              en: "I highly recommend this company, especially for designers as us. They are extremely good at matching the appropriate fabrics based on the clients' requirements. My company mainly purchases T-shirts,Sweatshirts, and our boss has very high standards for the fabrics. Every time, they will send me very satisfactory fabric options according to my requests. Therefore, the styles of our company have always sold very well, and they also get the sizing exactly right. In summary, the supplier that can make our company profitable is the best choice!"
            },
            avatar: "https://i.pravatar.cc/150?u=3"
          }
        ]
      }
    }
  ]
};

// src/jsonData/new_pages/page_about.json
var page_about_default = {
  id: "about",
  path: "/about",
  title: {
    zh: "\u5173\u4E8E\u6211\u4EEC",
    en: "About Us"
  },
  isFixed: true,
  lastModified: "2026-03-24T08:41:10.016Z",
  seo: {
    title: {
      zh: "Heavyweight Hoodie Manufacturer China",
      en: "Heavyweight Hoodie Manufacturer China"
    },
    description: {
      zh: "China-based factory specializing in custom heavyweight hoodies. Supports logo printing, embroidery, and private label services.",
      en: "China-based factory specializing in custom heavyweight hoodies. Supports logo printing, embroidery, and private label services."
    },
    keywords: {
      zh: "low shrinkage hoodie manufacturer China,hoodie garment colorfastness supplier Dongguan,custom branded hoodie factory China,wash-resistant hoodie supplier Dongguan,small MOQ streetwear manufacturer",
      en: "low shrinkage hoodie manufacturer China,hoodie garment colorfastness supplier Dongguan,custom branded hoodie factory China,wash-resistant hoodie supplier Dongguan,small MOQ streetwear manufacturer"
    },
    targetCountry: "United States, United Kingdom, Australia, Canada"
  },
  blocks: [
    {
      id: "block_GOjwGB84",
      type: "carousel",
      isVisible: true,
      content: {
        autoPlay: true,
        interval: 5e3,
        items: [
          {
            id: 1,
            image: "https://assets.kelloggfashion.com/uploads/25746a86-29.jpg",
            title: {
              zh: "",
              en: "China Heavyweight Garment Manufacturer | 600 GSM Hoodies & Custom Apparel"
            },
            subtitle: {
              zh: "\u526F\u6807\u9898",
              en: "featuring double-needle stitching,providing oversized fit blanks"
            },
            cta: {
              zh: "\u4E86\u89E3\u66F4\u591A",
              en: "Learn More"
            },
            link: {
              id: "1wvndz8qw",
              name: {
                zh: "\u7ACB\u5373\u884C\u52A8",
                en: "Take Action"
              },
              linkType: "internal",
              href: ""
            }
          },
          {
            id: 2,
            image: "https://assets.kelloggfashion.com/uploads/lunbotu__2__UH4XS9eXSVIAT79c.png",
            title: {
              zh: "500-640gsm heavy hoodies manufacturer",
              en: "500-640gsm heavy hoodies manufacturer"
            },
            subtitle: {
              zh: "High-quality knit T-shirts and heavyweight sweatshirts",
              en: "High-quality knit T-shirts and heavyweight sweatshirts"
            },
            cta: {
              zh: "\u4E86\u89E3\u66F4\u591A",
              en: "Learn More"
            },
            link: {
              id: "3g86hvbkj",
              name: {
                zh: "\u7ACB\u5373\u884C\u52A8",
                en: "Take Action"
              },
              linkType: "internal",
              href: ""
            }
          }
        ]
      }
    },
    {
      id: "block_lROTjWAm",
      type: "textSection",
      isVisible: true,
      content: {
        title: {
          zh: "Premium Streetwear Manufacturer in Dongguan, China",
          en: "Premium Streetwear Manufacturer in Dongguan, China"
        },
        content: {
          zh: "A premium heavyweight streetwear manufacturer in Dongguan, China specializing in oversized hoodies, washed garments, custom trims, and full-package production for global fashion brands.\nHelping global fashion brands build heavyweight, washed and oversized collections with reliable production and advanced garment technology.",
          en: "A premium heavyweight streetwear manufacturer in Dongguan, China specializing in oversized hoodies, washed garments, custom trims, and full-package production for global fashion brands.\nHelping global fashion brands build heavyweight, washed and oversized collections with reliable production and advanced garment technology."
        },
        alignment: "center",
        paddingY: "medium"
      }
    },
    {
      id: "block_7YI8JOWB",
      type: "imageText",
      isVisible: true,
      content: {
        title: {
          zh: "Company Profile \u2014 Kellogg Fashion",
          en: "Company Profile \u2014 Kellogg Fashion"
        },
        content: {
          zh: "Founded in 2023, Kellogg Fashion is a Dongguan-based streetwear clothing manufacturer specializing in heavyweight hoodies, oversized T-shirts, premium fleece garments, and custom streetwear production for global fashion brands. The company focuses on high-quality cut-and-sew apparel for the U.S., UK, Australian, and European markets, with strong expertise in 240\u2013600gsm heavyweight fabrics and modern streetwear silhouettes.//\n\nKellogg Fashion works closely with emerging streetwear labels, private-label startups, and independent fashion brands, helping clients develop premium-quality collections with flexible MOQs, fast sampling, and stable bulk production. The company\u2019s manufacturing capabilities cover fabric sourcing, pattern development, embroidery, screen printing, puff printing, acid wash, vintage wash, and garment dyeing.//\n\nTo ensure product consistency and premium hand-feel, Kellogg Fashion applies strict fabric quality standards, including://\n\nFabric shrinkage testing //\nGSM tolerance inspection //\nColor fastness testing //\nWash durability testing //\nFabric composition verification //\nStitching and needle inspection //\n\nThe company mainly works with high-quality cotton, French terry, brushed fleece, and heavyweight jersey fabrics designed for luxury streetwear and oversized fashion collections.//\n\nWith an efficient sampling and production system, Kellogg Fashion is able to support rapid product development and reliable lead times for both small-batch and scalable production orders. The company\u2019s mission is to help global fashion brands build premium streetwear products with stable quality, trend-driven craftsmanship, and strong fabric expertise.",
          en: "Founded in 2023, Kellogg Fashion is a Dongguan-based streetwear clothing manufacturer specializing in heavyweight hoodies, oversized T-shirts, premium fleece garments, and custom streetwear production for global fashion brands. The company focuses on high-quality cut-and-sew apparel for the U.S., UK, Australian, and European markets, with strong expertise in 240\u2013600gsm heavyweight fabrics and modern streetwear silhouettes.//\n\nKellogg Fashion works closely with emerging streetwear labels, private-label startups, and independent fashion brands, helping clients develop premium-quality collections with flexible MOQs, fast sampling, and stable bulk production. The company\u2019s manufacturing capabilities cover fabric sourcing, pattern development, embroidery, screen printing, puff printing, acid wash, vintage wash, and garment dyeing.//\n\nTo ensure product consistency and premium hand-feel, Kellogg Fashion applies strict fabric quality standards, including://\n\nFabric shrinkage testing //\nGSM tolerance inspection //\nColor fastness testing //\nWash durability testing //\nFabric composition verification //\nStitching and needle inspection //\n\nThe company mainly works with high-quality cotton, French terry, brushed fleece, and heavyweight jersey fabrics designed for luxury streetwear and oversized fashion collections.//\n\nWith an efficient sampling and production system, Kellogg Fashion is able to support rapid product development and reliable lead times for both small-batch and scalable production orders. The company\u2019s mission is to help global fashion brands build premium streetwear products with stable quality, trend-driven craftsmanship, and strong fabric expertise."
        },
        image: "https://assets.kelloggfashion.com/uploads/e8be5afb-1.jpg",
        imagePosition: "left",
        buttonText: {
          zh: "",
          en: "Get Free Quote  in 24 Hourse"
        },
        buttonLink: "https://wa.me/message/VPTYGENPVZYCL1"
      }
    },
    {
      id: "block_fnxGusU5",
      type: "imageText",
      isVisible: true,
      content: {
        title: {
          zh: "Production Line Overview \u2014 Kellogg Fashion",
          en: "Production Line Overview \u2014 Kellogg Fashion"
        },
        content: {
          zh: "At Kellogg Fashion, our production line is built specifically for premium streetwear and heavyweight garments. We specialize in sewing oversized hoodies, heavyweight sweatshirts, oversized T-shirts, joggers, and fleece products using high-GSM fabrics ranging from 240gsm to 600gsm.//\n\nOur sewing team is experienced in handling thick cotton, French terry, brushed fleece, and garment-dyed fabrics, ensuring clean construction, strong seam durability, and consistent garment shape after washing. We use professional sewing techniques such as double-needle stitching, coverstitch sewing, reinforced shoulder taping, rib attachment, and flatlock finishing to improve both comfort and long-term wear performance.//\n\nKellogg Fashion is especially skilled in producing://\nHeavyweight hoodies and sweatshirts //\nOversized streetwear silhouettes //\nAcid wash and vintage wash garments //\nPremium fleece apparel //\nCut-and-sew streetwear collections //\n\nEach production stage is carefully monitored by our QC team to ensure accurate sizing, stable stitching density, fabric consistency, and clean finishing before packing and shipment. Our factory is designed to support both small-batch brand development and scalable bulk production with stable lead times and flexible manufacturing solutions for U.S., UK, Australian, and European fashion brands.",
          en: "At Kellogg Fashion, our production line is built specifically for premium streetwear and heavyweight garments. We specialize in sewing oversized hoodies, heavyweight sweatshirts, oversized T-shirts, joggers, and fleece products using high-GSM fabrics ranging from 240gsm to 600gsm.//\n\nOur sewing team is experienced in handling thick cotton, French terry, brushed fleece, and garment-dyed fabrics, ensuring clean construction, strong seam durability, and consistent garment shape after washing. We use professional sewing techniques such as double-needle stitching, coverstitch sewing, reinforced shoulder taping, rib attachment, and flatlock finishing to improve both comfort and long-term wear performance.//\n\nKellogg Fashion is especially skilled in producing://\nHeavyweight hoodies and sweatshirts //\nOversized streetwear silhouettes //\nAcid wash and vintage wash garments //\nPremium fleece apparel //\nCut-and-sew streetwear collections //\n\nEach production stage is carefully monitored by our QC team to ensure accurate sizing, stable stitching density, fabric consistency, and clean finishing before packing and shipment. Our factory is designed to support both small-batch brand development and scalable bulk production with stable lead times and flexible manufacturing solutions for U.S., UK, Australian, and European fashion brands."
        },
        image: "https://assets.kelloggfashion.com/uploads/bafd8bad-2.jpg",
        imagePosition: "right",
        buttonText: {
          zh: "",
          en: "Get Free Quote  in 24 Hourse"
        },
        buttonLink: "https://wa.me/message/VPTYGENPVZYCL1"
      }
    },
    {
      id: "block_b4qwRB4_",
      type: "featureList",
      isVisible: true,
      content: {
        title: {
          zh: "What Makes Kellogg Different",
          en: "What Makes Kellogg Different"
        },
        features: [],
        columns: 3,
        items: [
          {
            icon: "Star",
            title: {
              zh: "1,Heavyweight Fabric Expertise",
              en: "1,Heavyweight Fabric Expertise"
            },
            description: {
              zh: "Kellogg Fashion specializes in heavyweight and premium streetwear fabrics, including 320gsm to 500gsm cotton and fleece materials. We focus on fabric stability, shrinkage control, softness, and long-term durability to ensure every hoodie and t-shirt maintains its structure, comfort, and premium feel after washing and repeated wear.",
              en: "Kellogg Fashion specializes in heavyweight and premium streetwear fabrics, including 320gsm to 500gsm cotton and fleece materials. We focus on fabric stability, shrinkage control, softness, and long-term durability to ensure every hoodie and t-shirt maintains its structure, comfort, and premium feel after washing and repeated wear."
            }
          },
          {
            icon: "Star",
            title: {
              zh: "2,Advanced Garment Washing Technology",
              en: "2,Advanced Garment Washing Technology"
            },
            description: {
              zh: "We provide professional garment washing solutions for modern streetwear brands, including vintage wash, enzyme wash, pigment dye, and faded effects. Our production process is designed to improve color consistency, reduce twisting problems, and maintain garment shape while achieving the authentic washed look demanded by today\u2019s fashion market.",
              en: "We provide professional garment washing solutions for modern streetwear brands, including vintage wash, enzyme wash, pigment dye, and faded effects. Our production process is designed to improve color consistency, reduce twisting problems, and maintain garment shape while achieving the authentic washed look demanded by today\u2019s fashion market."
            }
          },
          {
            icon: "Star",
            title: {
              zh: "3,Oversized Pattern Development",
              en: "3,Oversized Pattern Development"
            },
            description: {
              zh: "Our team has extensive experience developing oversized and streetwear-focused silhouettes, including boxy fits, drop shoulders, and relaxed cuts. We carefully balance proportions, garment drape, and fit consistency to help brands create modern streetwear collections that match current global fashion trends.",
              en: "Our team has extensive experience developing oversized and streetwear-focused silhouettes, including boxy fits, drop shoulders, and relaxed cuts. We carefully balance proportions, garment drape, and fit consistency to help brands create modern streetwear collections that match current global fashion trends."
            }
          },
          {
            icon: "Star",
            title: {
              zh: "4,Full Private Label Customization",
              en: "4,Full Private Label Customization"
            },
            description: {
              zh: "Kellogg Fashion offers complete private label manufacturing services, from custom woven labels and hangtags to packaging bags, embroidery, printing, and silicone branding applications. We help fashion brands build a fully customized identity with consistent quality, premium detailing, and scalable production support from sampling to bulk manufacturing.",
              en: "Kellogg Fashion offers complete private label manufacturing services, from custom woven labels and hangtags to packaging bags, embroidery, printing, and silicone branding applications. We help fashion brands build a fully customized identity with consistent quality, premium detailing, and scalable production support from sampling to bulk manufacturing."
            }
          }
        ]
      }
    },
    {
      id: "block_jITIaId_",
      type: "gallery",
      isVisible: true,
      content: {
        title: {
          zh: "Factory Details",
          en: "Factory Details"
        },
        subtitle: {
          zh: "Produced in our Dongguan garment manufacturing facility located in Guangdong, China. Our factory specializes in heavyweight hoodie manufacturing with strict shrinkage control, fabric stability testing, and premium finishing standards for global streetwear brands.",
          en: "Produced in our Dongguan garment manufacturing facility located in Guangdong, China.Our factory specializes in heavyweight hoodie manufacturing with strict shrinkage control, fabric stability testing, and premium finishing standards for global streetwear brands."
        },
        items: [
          {
            caption: {
              zh: "Make E-pattern",
              en: "Make E-pattern"
            },
            src: "https://assets.kelloggfashion.com/uploads/china-heavyweight-garment-factory_-1_LRcNXQZHefmozw6f.jpg"
          },
          {
            caption: {
              zh: "Cut and Sew manufacturer",
              en: "Cut and Sew manufacturer"
            },
            src: "https://assets.kelloggfashion.com/uploads/china-heavyweight-garment-factory_-2_6EwVNqJKSNSEqq9X.JPG"
          },
          {
            caption: {
              zh: "Premium garment construction",
              en: "Premium garment construction"
            },
            src: "https://assets.kelloggfashion.com/uploads/china-heavyweight-garment-factory_-3_sT4rfV3oHTBw2EiT.JPG"
          },
          {
            caption: {
              zh: "Quality control clothing factory",
              en: "Quality control clothing factory"
            },
            src: "https://assets.kelloggfashion.com/uploads/china-heavyweight-garment-factory_-4_4XK7FBhWAx026KdO.jpg"
          },
          {
            src: "https://assets.kelloggfashion.com/uploads/china-heavyweight-garment-factory_-5_6HdAHVnBd86P78Ff.jpg",
            caption: {
              zh: "Private label packaging",
              en: "Private label packaging"
            }
          },
          {
            src: "https://assets.kelloggfashion.com/uploads/china-heavyweight-garment-factory_-6_wf8vmOEpLEc55P7E.jpg",
            caption: {
              zh: "Warehouse ready to shipment",
              en: "Warehouse ready to shipment"
            }
          }
        ]
      }
    }
  ]
};

// src/jsonData/new_pages/page_faq.json
var page_faq_default = {
  id: "faq",
  path: "/faq",
  title: {
    zh: "\u5E38\u89C1\u95EE\u9898",
    en: "FAQ"
  },
  isFixed: true,
  lastModified: "2026-03-24T08:41:10.016Z",
  seo: {
    title: {
      zh: "Custom Knitwear Supplier China | OEM/ODM Hoodies, Sweatshirts & T-Shirts",
      en: "Custom Knitwear Supplier China | OEM/ODM Hoodies, Sweatshirts & T-Shirts"
    },
    description: {
      zh: "Private label solutions for heavyweight hoodies, including custom tags, packaging, and logos. Designed for global retailers and online stores.",
      en: "Private label solutions for heavyweight hoodies, including custom tags, packaging, and logos. Designed for global retailers and online stores."
    },
    keywords: {
      zh: "high GSM heavyweight fabric clothing factory,oversized streetwear manufacturer with custom labels,eco-friendly hoodie garment supplier Dongguan",
      en: "high GSM heavyweight fabric clothing factory,oversized streetwear manufacturer with custom labels,eco-friendly hoodie garment supplier Dongguan"
    },
    targetCountry: "United States, United Kingdom, Australia, Canada"
  },
  blocks: [
    {
      id: "block_G0OafeNZ",
      type: "textSection",
      isVisible: true,
      content: {
        title: {
          zh: "",
          en: "Custom hoodies manufacturer from China"
        },
        content: {
          zh: "",
          en: "We are a clothing company specializing in high-quality knit T-shirts and heavyweight sweatshirts. With expertise in managing high-density fabrics, we ensure minimal shrinkage and superior durability. Our focus is on delivering comfortable, long-lasting garments that combine style with practicality, meeting the needs of discerning customers who value both quality and performance."
        },
        alignment: "center",
        paddingY: "medium"
      }
    },
    {
      id: "block_vfwtuc_i",
      type: "faq",
      isVisible: true,
      content: {
        title: {
          zh: "",
          en: "FAQ"
        },
        subtitle: {
          zh: "",
          en: "Find the Answers You Need"
        },
        items: [
          {
            id: 1,
            question: {
              zh: "Q: What materials do you use for your hoodies? Can we request specific fabrics?",
              en: "Q: What materials do you use for your hoodies? Can we request specific fabrics?"
            },
            answer: {
              zh: "A: We use high-quality cotton, cotton-polyester blends, and organic materials. Custom fabric requests are welcome, and we can provide samples for your approval before bulk production.",
              en: "A: We use high-quality cotton, cotton-polyester blends, and organic materials. Custom fabric requests are welcome, and we can provide samples for your approval before bulk production."
            }
          },
          {
            id: 2,
            question: {
              zh: "Q: What quality control measures do you implement?",
              en: "Q: What quality control measures do you implement?"
            },
            answer: {
              zh: "A: We conduct 100% pre-shipment inspections covering fabric, stitching, sizing, and color consistency. Third-party inspections are welcome, ensuring products meet international quality standards.",
              en: "A: We conduct 100% pre-shipment inspections covering fabric, stitching, sizing, and color consistency. Third-party inspections are welcome, ensuring products meet international quality standards."
            }
          },
          {
            id: 3,
            question: {
              zh: "Q: Are your hoodies compliant with international safety and environmental standards?",
              en: "Q: Are your hoodies compliant with international safety and environmental standards?"
            },
            answer: {
              zh: "A: Yes, we comply with OEKO-TEX and GOTS standards, and our factories meet BSCI and ISO9001 requirements. We can provide certificates upon request.",
              en: "A: Yes, we comply with OEKO-TEX and GOTS standards, and our factories meet BSCI and ISO9001 requirements. We can provide certificates upon request."
            }
          },
          {
            id: 4,
            question: {
              zh: "Q: What is your monthly production capacity?",
              en: "Q: What is your monthly production capacity?"
            },
            answer: {
              zh: "A: Our factory produces up to 30,000+ hoodies per month. We manage multiple production lines, enabling both large-scale and small-batch orders without compromising quality or delivery schedules.",
              en: "A: Our factory produces up to 30,000+ hoodies per month. We manage multiple production lines, enabling both large-scale and small-batch orders without compromising quality or delivery schedules."
            }
          },
          {
            id: 5,
            question: {
              zh: "Q: Can we get samples before placing a bulk order?",
              en: "Q: Can we get samples before placing a bulk order?"
            },
            answer: {
              zh: "A: Yes, samples are available. Lead time is usually 7\u201310 days. Sample costs may apply but are refundable upon bulk order confirmation. This ensures you evaluate quality and design before production.",
              en: "A: Yes, samples are available. Lead time is usually 7\u201310 days. Sample costs may apply but are refundable upon bulk order confirmation. This ensures you evaluate quality and design before production."
            }
          },
          {
            id: 6,
            question: {
              zh: "Q: How you handle international shipping?",
              en: "Q: How you handle international shipping?"
            },
            answer: {
              zh: "A: Yes, we provide FOB, CIF, and DDP delivery options. We work with reliable freight forwarders and provide tracking and support to ensure timely delivery to your warehouse or destination.",
              en: "A: Yes, we provide FOB, CIF, and DDP delivery options. We work with reliable freight forwarders and provide tracking and support to ensure timely delivery to your warehouse or destination."
            }
          }
        ]
      }
    }
  ]
};

// src/jsonData/new_pages/page_products.json
var page_products_default = {
  id: "products",
  path: "/products",
  title: {
    zh: "\u5546\u54C1\u5C55\u793A",
    en: "Products"
  },
  isFixed: true,
  lastModified: "2026-03-24T08:41:10.016Z",
  seo: {
    title: {
      zh: "Unisex 400-500GSM Heavyweight Hoodie Supplier from Guangdong",
      en: "Unisex 400-500GSM Heavyweight Hoodie Supplier from Guangdong"
    },
    description: {
      zh: "Offering unisex heavyweight hoodies for bulk orders. Flexible customization options and efficient production for overseas clients.",
      en: "Offering unisex heavyweight hoodies for bulk orders. Flexible customization options and efficient production for overseas clients."
    },
    keywords: {
      zh: "custom streetwear manufacturing in Dongguan,high-quality hoodie supplier in China,bulk t-shirt printing manufacturer Dongguan,premium sweatshirt factory for export,400 GSM Heavyweight Hoodie Manufacturer,500 GSM French Terry Hoodie,Oversized Streetwear Hoodie OEM,Puff Print Hoodie Manufacturer,intage Wash Hoodie Supplier",
      en: "custom streetwear manufacturing in Dongguan,high-quality hoodie supplier in China,bulk t-shirt printing manufacturer Dongguan,premium sweatshirt factory for export,400 GSM Heavyweight Hoodie Manufacturer,500 GSM French Terry Hoodie,Oversized Streetwear Hoodie OEM,Puff Print Hoodie Manufacturer,intage Wash Hoodie Supplier"
    },
    targetCountry: "United States, United Kingdom, Australia, Canada"
  },
  blocks: [
    {
      id: "block_G0OiIuNZ",
      type: "imageBanner",
      isVisible: true,
      content: {
        tag: {
          zh: "2026\u6625\u590F\u7CFB\u5217",
          en: "2026 Spring Summer Collection"
        },
        title: {
          zh: "",
          en: "Private label T-shirt manufacturer"
        },
        subtitle: {
          zh: "",
          en: "Premium heavyweight T-shirt manufacturer in China. 240\u2013300 GSM cotton, oversized fit, custom printing & washing. Low MOQ, fast sampling."
        },
        image: "https://assets.kelloggfashion.com/uploads/20_ZAz30TgphKRQTduo.jpg",
        linkUrl: "https://kelloggfashion.com/product/147",
        ctaText: {
          zh: "",
          en: "S"
        }
      }
    },
    {
      id: "block_NmaIuc_i",
      type: "productGrid",
      isVisible: true,
      content: {
        itemsPerPage: 10
      }
    },
    {
      id: "block_P3mVYI9N",
      type: "imageText",
      isVisible: true,
      content: {
        title: {
          zh: "Custom 500 GSM Heavyweight Oversized Hoodie for Streetwear Brands",
          en: "Custom 500 GSM Heavyweight Oversized Hoodie for Streetwear Brands"
        },
        content: {
          zh: "Developed for premium streetwear labels, this custom oversized black hoodie is constructed from 500 GSM heavyweight brushed fleece, available in 100% combed cotton or 80% cotton / 20% polyester.",
          en: "Developed for premium streetwear labels, this custom oversized black hoodie is constructed from 500 GSM heavyweight brushed fleece, available in 100% combed cotton or 80% cotton / 20% polyester."
        },
        image: "https://assets.kelloggfashion.com/uploads/dca6fe6a-500 GSM Premium Cotton Fleece -8.jpg",
        imagePosition: "left",
        buttonText: {
          zh: "",
          en: "View More"
        },
        buttonLink: "https://kelloggfashion.com/product/181"
      }
    },
    {
      id: "block_JyKQAsgu",
      type: "featuredProducts",
      isVisible: true,
      content: {
        title: {
          zh: "\u7CBE\u9009\u4EA7\u54C1",
          en: "Featured Products"
        },
        maxItems: 8,
        layout: "grid"
      }
    }
  ]
};

// src/jsonData/new_pages/page_system-inquiry.json
var page_system_inquiry_default = {
  id: "system-inquiry",
  path: "/inquiry",
  title: {
    zh: "\u8BE2\u76D8\u4E0E\u8054\u7CFB\u6211\u4EEC",
    en: "Inquiry & Contact"
  },
  isFixed: true,
  type: "fixed-layout",
  lastModified: "2026-05-26T00:00:00.000Z",
  seo: {
    title: {
      zh: "400-640 GSM Hoodie Manufacturer China | Premium Cotton Fleece Hoodies",
      en: "400-640 GSM Hoodie Manufacturer China | Premium Cotton Fleece Hoodies"
    },
    description: {
      zh: "High-density 640 GSM hoodies with durable stitching and anti-pilling fabric. Ideal for premium brands. Flexible MOQ and fast development. Contact us for pricing.",
      en: "High-density 640 GSM hoodies with durable stitching and anti-pilling fabric. Ideal for premium brands. Flexible MOQ and fast development. Contact us for pricing."
    },
    targetCountry: "United, States, United Kingdom, Australia, Canada",
    keywords: {
      zh: "UK streetwear wholesale supplier China,European hoodie OEM manufacturer Dongguan,USA custom sweatshirt factory China,premium cotton t-shirt supplier Europe",
      en: "UK streetwear wholesale supplier China,European hoodie OEM manufacturer Dongguan,USA custom sweatshirt factory China,premium cotton t-shirt supplier Europe"
    }
  },
  blocks: [],
  content: {
    title: {
      zh: "\u8054\u7CFB\u6211\u4EEC\u8981\u6837\u54C1",
      en: "Contact Us For Samples"
    },
    description: {
      zh: "\u5982\u679C\u60A8\u6709\u4EFB\u4F55\u5173\u4E8E\u4EA7\u54C1\u7684\u54A8\u8BE2\uFF0C\u8BF7\u586B\u5199\u4E0B\u65B9\u8868\u683C\uFF0C\u6211\u4EEC\u7684\u56E2\u961F\u4F1A\u5C3D\u5FEB\u4E0E\u60A8\u8054\u7CFB\u3002",
      en: "If you have any inquiries about our products, please fill out the form below and our team will get back to you as soon as possible."
    }
  }
};

// src/jsonData/new_pages/page_system-blog.json
var page_system_blog_default = {
  id: "system-blog",
  path: "/blog",
  title: {
    zh: "\u535A\u5BA2",
    en: "Blog"
  },
  isFixed: true,
  type: "fixed-layout",
  lastModified: "2026-05-20T00:00:00.000Z",
  seo: {
    title: {
      zh: "\u535A\u5BA2\u4E0E\u8D44\u8BAF - Kellogg Fashion",
      en: "Blog & Resources - Kellogg Fashion"
    },
    description: {
      zh: "\u6D4F\u89C8 Kellogg Fashion \u535A\u5BA2\uFF0C\u83B7\u53D6\u6700\u65B0\u884C\u4E1A\u8D44\u8BAF\u3001\u9762\u6599\u6307\u5357\u3001\u670D\u88C5\u5236\u9020\u6280\u5DE7\u548C\u6D41\u884C\u8D8B\u52BF\u62A5\u544A\u3002",
      en: "Explore Kellogg Fashion blog for industry news, fabric guides, OEM tips, and trend reports from a leading apparel manufacturer."
    },
    keywords: {
      zh: "\u670D\u88C5\u5236\u9020\u535A\u5BA2,\u91CD\u78C5\u536B\u8863\u5236\u9020\u8D44\u8BAF,\u9762\u6599\u6307\u5357",
      en: "apparel manufacturing blog,heavyweight hoodie news,fabric guide,OEM tips"
    },
    targetCountry: "United States, United Kingdom, Australia, Canada"
  },
  blocks: []
};

// src/jsonData/new_pages/page_case-studies.json
var page_case_studies_default = {
  id: "case-studies",
  path: "/case-studies",
  title: {
    zh: "\u5BA2\u6237\u6848\u4F8B",
    en: "Case Studies"
  },
  isFixed: true,
  type: "fixed-layout",
  lastModified: "2026-05-26T00:00:00.000Z",
  seo: {
    title: {
      zh: "\u5BA2\u6237\u6848\u4F8B - Kellogg Fashion",
      en: "Case Studies - Kellogg Fashion"
    },
    description: {
      zh: "\u6765\u81EA\u5168\u7403\u54C1\u724C\u4E70\u5BB6\u7684\u771F\u5B9E\u7A7F\u642D\u89C6\u9891\u4E0E\u6210\u8863\u8BC4\u4EF7\uFF0C\u89C1\u8BC1 Kellogg Fashion \u7684\u670D\u88C5\u5236\u9020\u54C1\u8D28\u3002",
      en: "Real try-on videos and honest client case studies from global brand buyers \u2014 see Kellogg Fashion apparel quality in action."
    },
    keywords: {
      zh: "\u5BA2\u6237\u6848\u4F8B,\u5BA2\u6237\u8BC4\u4EF7,\u91CD\u78C5\u536B\u8863\u8BC4\u4EF7,\u670D\u88C5\u5B9A\u5236\u53CD\u9988",
      en: "case studies,client testimonials,heavyweight hoodie review,custom apparel feedback"
    },
    targetCountry: "United States, United Kingdom, Australia, Canada"
  },
  blocks: []
};

// src/jsonData/siteSetting.json
var siteSetting_default = {
  name: {
    zh: "\u4E1C\u839E\u51EF\u4E50\u683C\u670D\u9970\u6709\u9650\u516C\u53F8",
    en: "Kellogg Heavyweight"
  },
  logo: "https://assets.kelloggfashion.com/uploads/a0eb0a79-logo.jpg",
  description: {
    zh: "We are a professional Chinese manufacturer located in Humen Town Dongguan City Guangdong province, specializing in heavyweight hoodies from 400 GSM to 640 GSM, with 10+ years of experience in oversized streetwear production.",
    en: "We are a professional Chinese manufacturer located in Humen Town Dongguan City Guangdong province, specializing in heavyweight hoodies from 400 GSM to 640 GSM, with 10+ years of experience in oversized streetwear production."
  },
  contact: {
    email: "one@klogclothing.com.cn",
    phone: "+86 15112883162",
    address: {
      zh: "Room#1102, Hua Ding Building, No#34 Bo Chong Road, Humen Town, Dongguan City, Guangdong Province, China",
      en: "Room#1102, Hua Ding Building, No#34 Bo Chong Road, Humen Town, Dongguan City, Guangdong Province, China"
    }
  },
  socialMedia: {
    instagram: "https://www.instagram.com/kellogg_heavyweightstudio/",
    facebook: "https://www.facebook.com/profile.php?id=61589590452909",
    twitter: "https://twitter.com/kellogg",
    whatsapp: "https://wa.me/message/VPTYGENPVZYCL1",
    linkedin: "https://www.linkedin.com/company/dongguan-kellogg-fashion/",
    youtube: "https://www.youtube.com/channel/UCVqaqa34QfrXQwu7cObLsKw"
  }
};

// src/jsonData/header_config.json
var header_config_default = {
  logoText: {
    zh: "KELLOGG",
    en: "KELLOGG"
  },
  navItems: [
    {
      id: "n1",
      name: {
        zh: "\u9996\u9875",
        en: "Home"
      },
      href: "/",
      linkType: "internal",
      children: [
        {
          id: "3tmikv7Q",
          name: {
            zh: "\u9996\u9875",
            en: "Home"
          },
          linkType: "internal",
          href: "/",
          pageDeleted: false
        }
      ]
    },
    {
      id: "1778236314426",
      name: {
        zh: "\u6211\u4EEC\u7684\u4EA7\u54C1",
        en: "Products"
      },
      linkType: "internal",
      href: "/fabrics",
      pageDeleted: false,
      children: [
        {
          id: "HePWt0cd",
          name: {
            zh: "\u6211\u4EEC\u7684\u4EA7\u54C1",
            en: "Products"
          },
          linkType: "internal",
          href: "/products",
          pageDeleted: false
        }
      ]
    },
    {
      id: "1778236405740",
      name: {
        zh: "\u5173\u4E8E\u6211\u4EEC",
        en: "About us"
      },
      linkType: "internal",
      href: "/technology",
      pageDeleted: false,
      children: [
        {
          id: "GE6lR529",
          name: {
            zh: "\u5173\u4E8E\u6211\u4EEC",
            en: "About us"
          },
          linkType: "internal",
          href: "/about",
          pageDeleted: false
        },
        {
          id: "tHnRABpx",
          name: {
            zh: "\u5E38\u89C1\u95EE\u9898",
            en: "FAQ"
          },
          linkType: "internal",
          href: "/faq",
          pageDeleted: false
        }
      ]
    },
    {
      id: "1778236406348",
      name: {
        zh: " \u6211\u4EEC\u7684\u80FD\u529B",
        en: "Our capabilities"
      },
      linkType: "internal",
      href: "/solutions",
      pageDeleted: false,
      children: [
        {
          id: "5oWU3dx7",
          name: {
            zh: "\u9762\u6599",
            en: "Fabrics"
          },
          linkType: "internal",
          href: "/fabrics",
          pageDeleted: false
        },
        {
          id: "8XzEaI-r",
          name: {
            zh: "\u6280\u672F",
            en: "Technology"
          },
          linkType: "internal",
          href: "/technology",
          pageDeleted: false
        },
        {
          id: "ukAl_SOK",
          name: {
            zh: "\u89E3\u51B3\u65B9\u6848",
            en: "Solutions"
          },
          linkType: "internal",
          href: "/solutions",
          pageDeleted: false
        },
        {
          id: "xqogwByV",
          name: {
            zh: "\u5F00\u53D1\u670D\u52A1",
            en: "Development"
          },
          linkType: "internal",
          href: "/service",
          pageDeleted: false
        }
      ]
    },
    {
      id: "Wf5n2LTs",
      name: {
        zh: "\u8054\u7CFB\u6211\u4EEC",
        en: "Contact us"
      },
      linkType: "internal",
      href: "",
      children: [
        {
          id: "pUkcdA92",
          name: {
            zh: "\u8BE2\u76D8",
            en: "Inquiry"
          },
          linkType: "internal",
          href: "/inquiry",
          pageDeleted: false
        },
        {
          id: "4xY_DOIb",
          name: {
            zh: "\u535A\u5BA2",
            en: "Blog"
          },
          linkType: "internal",
          href: "/blog",
          pageDeleted: false
        }
      ]
    }
  ]
};

// src/jsonData/footer_config.json
var footer_config_default = {
  linkGroups: [
    {
      id: "g2",
      title: {
        zh: "About Us",
        en: "About Us"
      },
      links: [
        {
          id: "1778236042167",
          name: {
            zh: "FAQ",
            en: "FAQ"
          },
          linkType: "internal",
          href: "/faq",
          pageDeleted: false
        },
        {
          id: "1778236105546",
          name: {
            zh: "Customer Reviews",
            en: "Customer Reviews"
          },
          linkType: "internal",
          href: "/about",
          pageDeleted: false
        },
        {
          id: "1778236174222",
          name: {
            zh: "Privacy Policy",
            en: "Privacy Policy"
          },
          linkType: "internal",
          href: "/about",
          pageDeleted: false
        },
        {
          id: "1778291386288",
          name: {
            zh: "\u54A8\u8BE2\u6211\u4EEC",
            en: "Inquiry"
          },
          linkType: "internal",
          href: "/inquiry",
          pageDeleted: false
        }
      ]
    },
    {
      id: "1777089959085",
      title: {
        zh: "Each Link",
        en: "Each Link"
      },
      links: [
        {
          id: "1777090131053",
          name: {
            zh: "\u7F8E\u56FD\u7AD9\u70B9",
            en: "United States"
          },
          linkType: "internal",
          href: "/usa-heavyweight-hoodie-manufacturer",
          pageDeleted: false
        },
        {
          id: "1777090153085",
          name: {
            zh: "\u82F1\u56FD\u7AD9\u70B9",
            en: "United Kingdom"
          },
          linkType: "internal",
          href: "/uk-streetwear-clothing-manufacturer",
          pageDeleted: false
        },
        {
          id: "1777124817554",
          name: {
            zh: "\u6FB3\u5927\u5229\u4E9A\u7AD9\u70B9",
            en: "Australia"
          },
          linkType: "internal",
          href: "/australia-heavyweight-tshirt-supplier",
          pageDeleted: false
        },
        {
          id: "1777471404932",
          name: {
            zh: "\u52A0\u62FF\u5927\u7AD9\u70B9",
            en: "Canada"
          },
          linkType: "internal",
          href: "/canada-blank-apparel-supplier",
          pageDeleted: false
        }
      ]
    },
    {
      id: "1779208576234",
      title: {
        zh: "\u66F4\u591A",
        en: "More"
      },
      links: [
        {
          id: "1779208581002",
          name: {
            zh: "\u535A\u5BA2",
            en: "Blog"
          },
          linkType: "internal",
          href: "/blog",
          pageDeleted: false
        }
      ]
    }
  ],
  newsletterPlaceholder: {
    zh: "Subscribe",
    en: "Subscribe"
  },
  newsletterButton: {
    zh: "Subscribe",
    en: "Subscribe"
  }
};

// src/routes/system.ts
async function initKV(request, env) {
  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${env.ADMIN_TOKEN}`) {
    return errorResponse("Unauthorized: Please provide a valid ADMIN_TOKEN", env, 401);
  }
  try {
    console.log("[Init] Starting KV initialization from jsonData...");
    await env.KELLOGG_FRONTEND_CONFIG.put("pages_index", JSON.stringify(pages_index_default));
    console.log("[Init] pages_index initialized");
    await env.KELLOGG_FRONTEND_CONFIG.put("page:home", JSON.stringify(page_home_default));
    console.log("[Init] page:home initialized");
    await env.KELLOGG_FRONTEND_CONFIG.put("page:about", JSON.stringify(page_about_default));
    console.log("[Init] page:about initialized");
    await env.KELLOGG_FRONTEND_CONFIG.put("page:faq", JSON.stringify(page_faq_default));
    console.log("[Init] page:faq initialized");
    await env.KELLOGG_FRONTEND_CONFIG.put("page:products", JSON.stringify(page_products_default));
    console.log("[Init] page:products initialized");
    await env.KELLOGG_FRONTEND_CONFIG.put("page:system-inquiry", JSON.stringify(page_system_inquiry_default));
    console.log("[Init] page:system-inquiry initialized");
    await env.KELLOGG_FRONTEND_CONFIG.put("page:system-blog", JSON.stringify(page_system_blog_default));
    console.log("[Init] page:system-blog initialized");
    await env.KELLOGG_FRONTEND_CONFIG.put("page:case-studies", JSON.stringify(page_case_studies_default));
    console.log("[Init] page:case-studies initialized");
    await env.KELLOGG_FRONTEND_CONFIG.put("site_settings", JSON.stringify(siteSetting_default));
    console.log("[Init] Site settings initialized");
    await env.KELLOGG_FRONTEND_CONFIG.put("header_config", JSON.stringify(header_config_default));
    console.log("[Init] Header initialized");
    await env.KELLOGG_FRONTEND_CONFIG.put("footer_config", JSON.stringify(footer_config_default));
    console.log("[Init] Footer initialized");
    return jsonResponse({
      success: true,
      message: "KV data initialized successfully from jsonData shards",
      initializedKeys: [
        "pages_index",
        "page:home",
        "page:about",
        "page:faq",
        "page:products",
        "page:system-inquiry",
        "page:system-blog",
        "page:case-studies",
        "site_settings",
        "header_config",
        "footer_config"
      ]
    }, env);
  } catch (error) {
    console.error("[Init] Error:", error);
    return errorResponse(`Initialization failed: ${error.message}`, env, 500);
  }
}
__name(initKV, "initKV");
async function markChangesPending(env) {
  try {
    const statusStr = await env.KELLOGG_FRONTEND_CONFIG.get("build_status");
    let status = { hasChanges: true, lastBuildTime: "" };
    if (statusStr) {
      try {
        const parsed = JSON.parse(statusStr);
        status = {
          ...parsed,
          hasChanges: true
        };
      } catch (e) {
      }
    }
    await env.KELLOGG_FRONTEND_CONFIG.put("build_status", JSON.stringify(status));
    console.log("[ChangeTracker] Marked hasChanges as true");
  } catch (error) {
    console.error("[ChangeTracker] Failed to mark changes pending:", error);
  }
}
__name(markChangesPending, "markChangesPending");
async function triggerBuild(request, env) {
  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${env.ADMIN_TOKEN}`) {
    return errorResponse("Unauthorized: Please provide a valid ADMIN_TOKEN", env, 401);
  }
  const deployHookUrl = env.DEPLOY_HOOK_URL;
  if (!deployHookUrl) {
    return errorResponse("Deploy hook URL (DEPLOY_HOOK_URL) is not configured in Worker environment variables.", env, 500);
  }
  try {
    console.log("[Deploy] Triggering deploy hook:", deployHookUrl);
    const response = await fetch(deployHookUrl, {
      method: "POST"
    });
    if (!response.ok) {
      const errorText = await response.text();
      return errorResponse(`Failed to trigger deploy hook: ${response.statusText} - ${errorText}`, env, response.status);
    }
    const statusStr = await env.KELLOGG_FRONTEND_CONFIG.get("build_status");
    let status = { hasChanges: false, lastBuildTime: (/* @__PURE__ */ new Date()).toISOString() };
    if (statusStr) {
      try {
        const parsed = JSON.parse(statusStr);
        status = {
          ...parsed,
          hasChanges: false,
          lastBuildTime: (/* @__PURE__ */ new Date()).toISOString()
        };
      } catch (e) {
      }
    }
    await env.KELLOGG_FRONTEND_CONFIG.put("build_status", JSON.stringify(status));
    console.log("[Deploy] Deploy triggered successfully, marked hasChanges as false");
    return jsonResponse({
      success: true,
      message: "Build triggered successfully",
      buildStatus: status
    }, env);
  } catch (error) {
    console.error("[Deploy] Error:", error);
    return errorResponse(`Failed to trigger build: ${error.message}`, env, 500);
  }
}
__name(triggerBuild, "triggerBuild");

// src/routes/products.ts
async function getProducts(request, env) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const pageSize = parseInt(url.searchParams.get("pageSize") || "10");
  const category = url.searchParams.get("category");
  const isFeatured = url.searchParams.get("featured") === "true";
  const sort = url.searchParams.get("sort") || "newest";
  let whereClauses = [];
  let params = [];
  if (category && category !== "all") {
    whereClauses.push("category_id = ?");
    params.push(category);
  }
  if (isFeatured) {
    whereClauses.push("is_featured = 1");
  }
  const authError = verifyAdminToken(request, env);
  if (authError || !env.ADMIN_TOKEN) {
    whereClauses.push("is_active = 1");
  }
  const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
  let orderBy = "created_at DESC";
  if (sort === "price-asc")
    orderBy = "price ASC";
  else if (sort === "price-desc")
    orderBy = "price DESC";
  else if (sort === "popular")
    orderBy = "sales DESC";
  const offset = (page - 1) * pageSize;
  const totalRes = await env.DB.prepare(`SELECT COUNT(*) as count FROM products ${whereString}`).bind(...params).first();
  const total = totalRes?.count || 0;
  const productsRows = await env.DB.prepare(
    `SELECT * FROM products ${whereString} ORDER BY ${orderBy} LIMIT ? OFFSET ?`
  ).bind(...params, pageSize, offset).all();
  const { results: imageRows } = await env.DB.prepare(
    `SELECT * FROM product_images ORDER BY sort_order ASC`
  ).all();
  const { results: sizeRows } = await env.DB.prepare(
    `SELECT * FROM product_sizes ORDER BY sort_order ASC`
  ).all();
  const { results: colorRows } = await env.DB.prepare(
    `SELECT * FROM product_colors ORDER BY sort_order ASC`
  ).all();
  const { results: customFieldRows } = await env.DB.prepare(
    `SELECT * FROM product_custom_fields ORDER BY sort_order ASC`
  ).all();
  const { results: videoRows } = await env.DB.prepare(
    `SELECT * FROM product_videos ORDER BY sort_order ASC`
  ).all();
  const transformed = productsRows.results.map((row) => transformProduct(row, imageRows, sizeRows, colorRows, customFieldRows, videoRows, env.ASSETS_BASE_URL));
  return paginatedResponse(transformed, page, pageSize, total, env, request);
}
__name(getProducts, "getProducts");
async function getProduct(request, env, id) {
  const row = await env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(id).first();
  if (!row)
    return errorResponse("\u5546\u54C1\u4E0D\u5B58\u5728", env, 404);
  const authError = verifyAdminToken(request, env);
  const isAdmin = !authError && !!env.ADMIN_TOKEN;
  if (!isAdmin && row.is_active === 0) {
    return errorResponse("\u5546\u54C1\u5DF2\u4E0B\u67B6", env, 404);
  }
  const images = await env.DB.prepare("SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC").bind(id).all();
  const sizes = await env.DB.prepare("SELECT * FROM product_sizes WHERE product_id = ? ORDER BY sort_order ASC").bind(id).all();
  const colors = await env.DB.prepare("SELECT * FROM product_colors WHERE product_id = ? ORDER BY sort_order ASC").bind(id).all();
  const customFields = await env.DB.prepare("SELECT * FROM product_custom_fields WHERE product_id = ? ORDER BY sort_order ASC").bind(id).all();
  const videos = await env.DB.prepare("SELECT * FROM product_videos WHERE product_id = ? ORDER BY sort_order ASC").bind(id).all();
  return jsonResponse(transformProduct(row, images.results, sizes.results, colors.results, customFields.results, videos.results, env.ASSETS_BASE_URL), env, 200, request);
}
__name(getProduct, "getProduct");
async function createProduct(request, env) {
  const authError = verifyAdminToken(request, env);
  if (authError)
    return authError;
  const input = await request.json();
  if (!input.name_zh || !input.name_en || !input.price) {
    return errorResponse("\u5FC5\u586B\u9879\u7F3A\u5931", env, 400);
  }
  const result = await env.DB.prepare(
    `INSERT INTO products (name_zh, name_en, price, original_price, bulk_prices, image, category_id, rating, sales, tag_zh, tag_en, description_zh, description_en, fabric_zh, fabric_en, notes_zh, notes_en, release_date, is_featured, is_active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    input.name_zh,
    input.name_en,
    input.price,
    input.original_price || null,
    JSON.stringify(input.bulk_prices || []),
    input.image || null,
    input.category_id || null,
    input.rating || 5,
    input.sales || 0,
    input.tag_zh || null,
    input.tag_en || null,
    input.description_zh || null,
    input.description_en || null,
    input.fabric_zh || null,
    input.fabric_en || null,
    input.notes_zh || null,
    input.notes_en || null,
    input.release_date || null,
    input.is_featured ? 1 : 0,
    input.is_active !== false ? 1 : 0,
    input.sort_order || 0
  ).run();
  const productId = result.meta.last_row_id;
  if (input.images && Array.isArray(input.images)) {
    for (let i = 0; i < input.images.length; i++) {
      await env.DB.prepare("INSERT INTO product_images (product_id, image_key, sort_order) VALUES (?, ?, ?)").bind(productId, input.images[i], i).run();
    }
  }
  if (input.sizes && Array.isArray(input.sizes)) {
    for (let i = 0; i < input.sizes.length; i++) {
      await env.DB.prepare("INSERT INTO product_sizes (product_id, name, image, sort_order) VALUES (?, ?, ?, ?)").bind(productId, input.sizes[i].name, input.sizes[i].image || null, i).run();
    }
  }
  if (input.colors && Array.isArray(input.colors)) {
    for (let i = 0; i < input.colors.length; i++) {
      await env.DB.prepare("INSERT INTO product_colors (product_id, name_zh, name_en, image, sort_order) VALUES (?, ?, ?, ?, ?)").bind(productId, input.colors[i].name_zh, input.colors[i].name_en, input.colors[i].image || null, i).run();
    }
  }
  if (input.custom_fields && Array.isArray(input.custom_fields)) {
    for (let i = 0; i < input.custom_fields.length; i++) {
      await env.DB.prepare("INSERT INTO product_custom_fields (product_id, name_zh, name_en, value_zh, value_en, sort_order) VALUES (?, ?, ?, ?, ?, ?)").bind(productId, input.custom_fields[i].name_zh, input.custom_fields[i].name_en, input.custom_fields[i].value_zh, input.custom_fields[i].value_en, i).run();
    }
  }
  if (input.videos && Array.isArray(input.videos)) {
    for (let i = 0; i < input.videos.length; i++) {
      if (input.videos[i]) {
        await env.DB.prepare("INSERT INTO product_videos (product_id, video_url, sort_order) VALUES (?, ?, ?)").bind(productId, input.videos[i], i).run();
      }
    }
  }
  await markChangesPending(env);
  return jsonResponse({ id: productId, message: "\u521B\u5EFA\u6210\u529F" }, env, 201);
}
__name(createProduct, "createProduct");
async function updateProduct(request, env, id) {
  const authError = verifyAdminToken(request, env);
  if (authError)
    return authError;
  const input = await request.json();
  const productId = parseInt(id);
  const updates = [];
  const params = [];
  const fields = ["name_zh", "name_en", "price", "original_price", "bulk_prices", "image", "category_id", "rating", "sales", "tag_zh", "tag_en", "description_zh", "description_en", "fabric_zh", "fabric_en", "notes_zh", "notes_en", "release_date", "sort_order"];
  fields.forEach((f) => {
    if (input[f] !== void 0) {
      updates.push(`${f} = ?`);
      let val = input[f];
      if (f === "bulk_prices")
        val = JSON.stringify(val);
      params.push(val);
    }
  });
  if (input.is_featured !== void 0) {
    updates.push("is_featured = ?");
    params.push(input.is_featured ? 1 : 0);
  }
  if (input.is_active !== void 0) {
    updates.push("is_active = ?");
    params.push(input.is_active ? 1 : 0);
  }
  if (updates.length > 0) {
    params.push(productId);
    await env.DB.prepare(`UPDATE products SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(...params).run();
  }
  if (input.images !== void 0) {
    await env.DB.prepare("DELETE FROM product_images WHERE product_id = ?").bind(productId).run();
    if (Array.isArray(input.images)) {
      for (let i = 0; i < input.images.length; i++) {
        await env.DB.prepare("INSERT INTO product_images (product_id, image_key, sort_order) VALUES (?, ?, ?)").bind(productId, input.images[i], i).run();
      }
    }
  }
  if (input.sizes !== void 0) {
    await env.DB.prepare("DELETE FROM product_sizes WHERE product_id = ?").bind(productId).run();
    if (Array.isArray(input.sizes)) {
      for (let i = 0; i < input.sizes.length; i++) {
        await env.DB.prepare("INSERT INTO product_sizes (product_id, name, image, sort_order) VALUES (?, ?, ?, ?)").bind(productId, input.sizes[i].name, input.sizes[i].image || null, i).run();
      }
    }
  }
  if (input.colors !== void 0) {
    await env.DB.prepare("DELETE FROM product_colors WHERE product_id = ?").bind(productId).run();
    if (Array.isArray(input.colors)) {
      for (let i = 0; i < input.colors.length; i++) {
        await env.DB.prepare("INSERT INTO product_colors (product_id, name_zh, name_en, image, sort_order) VALUES (?, ?, ?, ?, ?)").bind(productId, input.colors[i].name_zh, input.colors[i].name_en, input.colors[i].image || null, i).run();
      }
    }
  }
  if (input.custom_fields !== void 0) {
    await env.DB.prepare("DELETE FROM product_custom_fields WHERE product_id = ?").bind(productId).run();
    if (Array.isArray(input.custom_fields)) {
      for (let i = 0; i < input.custom_fields.length; i++) {
        await env.DB.prepare("INSERT INTO product_custom_fields (product_id, name_zh, name_en, value_zh, value_en, sort_order) VALUES (?, ?, ?, ?, ?, ?)").bind(productId, input.custom_fields[i].name_zh, input.custom_fields[i].name_en, input.custom_fields[i].value_zh, input.custom_fields[i].value_en, i).run();
      }
    }
  }
  if (input.videos !== void 0) {
    await env.DB.prepare("DELETE FROM product_videos WHERE product_id = ?").bind(productId).run();
    if (Array.isArray(input.videos)) {
      for (let i = 0; i < input.videos.length; i++) {
        if (input.videos[i]) {
          await env.DB.prepare("INSERT INTO product_videos (product_id, video_url, sort_order) VALUES (?, ?, ?)").bind(productId, input.videos[i], i).run();
        }
      }
    }
  }
  await markChangesPending(env);
  return jsonResponse({ message: "\u66F4\u65B0\u6210\u529F" }, env);
}
__name(updateProduct, "updateProduct");
async function deleteProduct(request, env, id) {
  const authError = verifyAdminToken(request, env);
  if (authError)
    return authError;
  await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
  await markChangesPending(env);
  return jsonResponse({ message: "\u5220\u9664\u6210\u529F" }, env);
}
__name(deleteProduct, "deleteProduct");

// src/routes/categories.ts
async function getCategories(request, env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM categories ORDER BY sort_order ASC"
  ).all();
  const categories = results.map((row) => transformCategory(row, env.ASSETS_BASE_URL));
  return jsonResponse(categories, env, 200, request);
}
__name(getCategories, "getCategories");
async function getCategory(request, env, id) {
  const category = await env.DB.prepare(
    "SELECT * FROM categories WHERE id = ?"
  ).bind(id).first();
  if (!category) {
    return errorResponse("\u5206\u7C7B\u4E0D\u5B58\u5728", env, 404);
  }
  return jsonResponse(transformCategory(category, env.ASSETS_BASE_URL), env, 200, request);
}
__name(getCategory, "getCategory");
async function createCategory(request, env) {
  const authError = verifyAdminToken(request, env);
  if (authError)
    return authError;
  const input = await request.json();
  if (!input.id || !input.name_zh || !input.name_en) {
    return errorResponse("\u7F3A\u5C11\u5FC5\u586B\u5B57\u6BB5: id, name_zh, name_en", env, 400);
  }
  const existing = await env.DB.prepare(
    "SELECT id FROM categories WHERE id = ?"
  ).bind(input.id).first();
  if (existing) {
    return errorResponse("\u5206\u7C7B ID \u5DF2\u5B58\u5728", env, 400);
  }
  await env.DB.prepare(
    "INSERT INTO categories (id, name_zh, name_en, image, sort_order) VALUES (?, ?, ?, ?, ?)"
  ).bind(
    input.id,
    input.name_zh,
    input.name_en,
    input.image || null,
    input.sort_order || 0
  ).run();
  await markChangesPending(env);
  return jsonResponse({ id: input.id, message: "\u5206\u7C7B\u521B\u5EFA\u6210\u529F" }, env, 201);
}
__name(createCategory, "createCategory");
async function updateCategory(request, env, id) {
  const authError = verifyAdminToken(request, env);
  if (authError)
    return authError;
  const input = await request.json();
  const existing = await env.DB.prepare(
    "SELECT id FROM categories WHERE id = ?"
  ).bind(id).first();
  if (!existing) {
    return errorResponse("\u5206\u7C7B\u4E0D\u5B58\u5728", env, 404);
  }
  const updates = [];
  const params = [];
  if (input.name_zh !== void 0) {
    updates.push("name_zh = ?");
    params.push(input.name_zh);
  }
  if (input.name_en !== void 0) {
    updates.push("name_en = ?");
    params.push(input.name_en);
  }
  if (input.sort_order !== void 0) {
    updates.push("sort_order = ?");
    params.push(input.sort_order);
  }
  if (input.image !== void 0) {
    updates.push("image = ?");
    params.push(input.image);
  }
  if (updates.length > 0) {
    params.push(id);
    await env.DB.prepare(
      `UPDATE categories SET ${updates.join(", ")} WHERE id = ?`
    ).bind(...params).run();
  }
  await markChangesPending(env);
  return jsonResponse({ message: "\u5206\u7C7B\u66F4\u65B0\u6210\u529F" }, env);
}
__name(updateCategory, "updateCategory");
async function deleteCategory(request, env, id) {
  const authError = verifyAdminToken(request, env);
  if (authError)
    return authError;
  if (id === "all") {
    return errorResponse("\u4E0D\u80FD\u5220\u9664\u9ED8\u8BA4\u5206\u7C7B", env, 400);
  }
  const result = await env.DB.prepare(
    "DELETE FROM categories WHERE id = ?"
  ).bind(id).run();
  if (result.meta.changes === 0) {
    return errorResponse("\u5206\u7C7B\u4E0D\u5B58\u5728", env, 404);
  }
  await markChangesPending(env);
  return jsonResponse({ message: "\u5206\u7C7B\u5220\u9664\u6210\u529F" }, env);
}
__name(deleteCategory, "deleteCategory");

// src/routes/upload.ts
function generateRandomString(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
__name(generateRandomString, "generateRandomString");
async function uploadImage(request, env) {
  const authError = verifyAdminToken(request, env);
  if (authError)
    return authError;
  const formData = await request.formData();
  const file = formData.get("file");
  const width = formData.get("width") || "";
  const height = formData.get("height") || "";
  if (!file) {
    return errorResponse("\u672A\u63D0\u4F9B\u6587\u4EF6", env, 400);
  }
  const originalName = file.name.substring(0, file.name.lastIndexOf(".")).replace(/[^a-zA-Z0-9_-]/g, "_");
  const extension = file.name.substring(file.name.lastIndexOf("."));
  const randomSuffix = generateRandomString(16);
  const newFilename = `${originalName}_${randomSuffix}${extension}`;
  const key = `uploads/${newFilename}`;
  const thumbKey = `thumbnails/${newFilename}`;
  const arrayBuffer = await file.arrayBuffer();
  await env.ASSETS.put(key, arrayBuffer, {
    httpMetadata: { contentType: file.type },
    customMetadata: {
      originalName: file.name,
      width,
      height,
      uploadedAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
  try {
    const thumbResizingUrl = `${env.ASSETS_BASE_URL}/cdn-cgi/image/width=150,quality=75,format=auto/uploads/${newFilename}`;
    const thumbResponse = await fetch(thumbResizingUrl);
    if (thumbResponse.ok) {
      const thumbBuffer = await thumbResponse.arrayBuffer();
      await env.ASSETS.put(thumbKey, thumbBuffer, {
        httpMetadata: { contentType: thumbResponse.headers.get("Content-Type") || file.type }
      });
      console.log(`Thumbnail created for: ${newFilename}`);
    } else {
      console.warn(`Thumbnail generation failed (status: ${thumbResponse.status}) for ${newFilename}`);
    }
  } catch (err) {
    console.error(`Failed to generate thumbnail for ${newFilename}:`, err);
  }
  return jsonResponse({
    url: `${env.ASSETS_BASE_URL}/${key}`,
    thumbUrl: `${env.ASSETS_BASE_URL}/${thumbKey}`,
    key,
    name: newFilename,
    dimensions: width && height ? `${width}x${height}` : void 0
  }, env);
}
__name(uploadImage, "uploadImage");
async function uploadImages(request, env) {
  const authError = verifyAdminToken(request, env);
  if (authError)
    return authError;
  const formData = await request.formData();
  const files = formData.getAll("files");
  const results = [];
  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-1", arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    const shortHash = hashHex.substring(0, 8);
    const key = `uploads/${shortHash}-${file.name}`;
    await env.ASSETS.put(key, arrayBuffer, {
      httpMetadata: { contentType: file.type }
    });
    results.push({
      url: `${env.ASSETS_BASE_URL}/${key}`,
      key
    });
  }
  return jsonResponse(results, env);
}
__name(uploadImages, "uploadImages");
async function deleteImage(request, env) {
  const authError = verifyAdminToken(request, env);
  if (authError)
    return authError;
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key)
    return errorResponse("\u7F3A\u5C11 key", env, 400);
  await env.ASSETS.delete(key);
  return jsonResponse({ message: "\u5220\u9664\u6210\u529F" }, env);
}
__name(deleteImage, "deleteImage");
async function listImages(request, env) {
  const authError = verifyAdminToken(request, env);
  if (authError)
    return authError;
  const listed = await env.ASSETS.list({
    prefix: "uploads/",
    include: ["customMetadata"]
  });
  const results = listed.objects.map((obj) => {
    const filename = obj.key.replace("uploads/", "");
    const meta = obj.customMetadata || {};
    return {
      key: obj.key,
      name: filename,
      url: `${env.ASSETS_BASE_URL}/${obj.key}`,
      // 缩略图路径: thumbnails/文件名 (如果不存在则回退原图)
      thumbUrl: `${env.ASSETS_BASE_URL}/thumbnails/${filename}`,
      size: obj.size,
      dimensions: meta.width && meta.height ? `${meta.width}x${meta.height}` : void 0,
      uploaded: obj.uploaded
    };
  });
  results.sort((a, b) => new Date(b.uploaded).getTime() - new Date(a.uploaded).getTime());
  return jsonResponse(results, env);
}
__name(listImages, "listImages");
async function serveMedia(request, env, filename) {
  const decodedFilename = decodeURIComponent(filename);
  const key = `uploads/${decodedFilename}`;
  const rangeHeader = request.headers.get("Range");
  try {
    let object;
    if (rangeHeader) {
      object = await env.ASSETS.get(key, {
        range: request.headers,
        onlyIf: request.headers
      });
    } else {
      object = await env.ASSETS.get(key, {
        onlyIf: request.headers
      });
    }
    if (!object || !("body" in object)) {
      return errorResponse(`\u8D44\u6E90\u4E0D\u5B58\u5728: ${decodedFilename}`, env, 404);
    }
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "public, max-age=31536000");
    const status = rangeHeader ? 206 : 200;
    return new Response(object.body, {
      headers,
      status
    });
  } catch (err) {
    console.error(`Serve Media Error:`, err);
    return errorResponse("\u65E0\u6CD5\u83B7\u53D6\u5A92\u4F53\u8D44\u6E90", env, 500);
  }
}
__name(serveMedia, "serveMedia");
async function serveOptimizedMedia(request, env, filename) {
  const url = new URL(request.url);
  const w = parseInt(url.searchParams.get("w") || "0");
  const targetWidth = w > 0 ? Math.min(Math.max(w, 16), 3840) : 768;
  const quality = targetWidth <= 768 ? 75 : 85;
  const sourceUrl = `${env.ASSETS_BASE_URL}/uploads/${filename}`;
  const optimizedUrl = `${env.ASSETS_BASE_URL}/cdn-cgi/image/width=${targetWidth},quality=${quality},format=auto/uploads/${filename}`;
  try {
    const response = await fetch(sourceUrl, {
      cf: {
        image: {
          width: targetWidth,
          quality,
          fit: "scale-down"
        }
      }
    });
    if (response.ok) {
      const headers = new Headers(response.headers);
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
      headers.set("Access-Control-Allow-Origin", "*");
      const contentType = response.headers.get("Content-Type");
      if (!contentType || contentType.includes("text") || contentType.includes("application")) {
        const ext = filename.split(".").pop()?.toLowerCase();
        const type = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
        headers.set("Content-Type", type);
      }
      return new Response(response.body, {
        status: response.status,
        headers
      });
    }
    console.warn(`Worker-side optimization not available, redirecting to: ${optimizedUrl}`);
    return Response.redirect(optimizedUrl, 302);
  } catch (err) {
    console.warn(`Optimization error, falling back to redirect:`, err);
    return Response.redirect(optimizedUrl, 302);
  }
}
__name(serveOptimizedMedia, "serveOptimizedMedia");

// src/routes/config.ts
async function getConfig(request, env, key) {
  const value = await env.KELLOGG_FRONTEND_CONFIG.get(key, "json");
  if (value === null) {
    if (key === "site_settings" || key === "header_config" || key === "footer_config") {
      return jsonResponse({}, env);
    }
    if (key === "pages")
      return jsonResponse([], env);
    return errorResponse(`\u914D\u7F6E\u9879 ${key} \u4E0D\u5B58\u5728`, env, 404);
  }
  return jsonResponse(value, env, 200, request);
}
__name(getConfig, "getConfig");
async function setConfig(request, env) {
  const authError = verifyAdminToken(request, env);
  if (authError)
    return authError;
  const { key, value } = await request.json();
  if (!key)
    return errorResponse("\u7F3A\u5C11\u914D\u7F6E key", env, 400);
  await env.KELLOGG_FRONTEND_CONFIG.put(key, JSON.stringify(value));
  await markChangesPending(env);
  return jsonResponse({ message: "\u914D\u7F6E\u4FDD\u5B58\u6210\u529F", key }, env);
}
__name(setConfig, "setConfig");
async function deleteConfig(request, env, key) {
  const authError = verifyAdminToken(request, env);
  if (authError)
    return authError;
  if (!key)
    return errorResponse("\u7F3A\u5C11\u914D\u7F6E key", env, 400);
  await env.KELLOGG_FRONTEND_CONFIG.delete(key);
  await markChangesPending(env);
  return jsonResponse({ message: "\u914D\u7F6E\u5220\u9664\u6210\u529F", key }, env);
}
__name(deleteConfig, "deleteConfig");
async function getPages(request, env) {
  let pages = await env.KELLOGG_FRONTEND_CONFIG.get("pages_index", "json");
  if (!pages) {
    pages = await env.KELLOGG_FRONTEND_CONFIG.get("pages", "json");
  }
  const rawPages = pages || [];
  const patchedPages = rawPages.map((page) => ({
    ...page,
    seo: page.seo || {
      title: {
        zh: `${page.title?.zh || ""} | KELLOGG`,
        en: `${page.title?.en || ""} | KELLOGG`
      },
      description: { zh: "", en: "" }
    }
  }));
  return jsonResponse(patchedPages, env, 200, request);
}
__name(getPages, "getPages");
async function getPageById(request, env, id) {
  let pageData = await env.KELLOGG_FRONTEND_CONFIG.get(`page:${id}`, "json");
  if (!pageData) {
    const pagesIndex = await env.KELLOGG_FRONTEND_CONFIG.get("pages_index", "json");
    if (pagesIndex) {
      const targetPage = pagesIndex.find((p) => p.id === id);
      if (targetPage) {
        pageData = targetPage;
      }
    }
  }
  if (!pageData) {
    const pages = await env.KELLOGG_FRONTEND_CONFIG.get("pages", "json");
    const rawPages = pages || [];
    const targetPage = rawPages.find((p) => p.id === id);
    if (!targetPage) {
      return errorResponse(`Page ${id} not found`, env, 404);
    }
    pageData = targetPage;
  }
  return jsonResponse(pageData, env, 200, request);
}
__name(getPageById, "getPageById");
async function updatePages(request, env) {
  const authError = verifyAdminToken(request, env);
  if (authError)
    return authError;
  const pages = await request.json();
  await env.KELLOGG_FRONTEND_CONFIG.put("pages", JSON.stringify(pages));
  await markChangesPending(env);
  return jsonResponse({ message: "\u9875\u9762\u914D\u7F6E\u66F4\u65B0\u6210\u529F" }, env);
}
__name(updatePages, "updatePages");
async function getSiteSettings(request, env) {
  const settings = await env.KELLOGG_FRONTEND_CONFIG.get("site_settings", "json");
  return jsonResponse(settings || {}, env, 200, request);
}
__name(getSiteSettings, "getSiteSettings");
async function updateSiteSettings(request, env) {
  const authError = verifyAdminToken(request, env);
  if (authError)
    return authError;
  const input = await request.json();
  await env.KELLOGG_FRONTEND_CONFIG.put("site_settings", JSON.stringify(input));
  await markChangesPending(env);
  return jsonResponse({ message: "\u7AD9\u70B9\u8BBE\u7F6E\u66F4\u65B0\u6210\u529F" }, env);
}
__name(updateSiteSettings, "updateSiteSettings");
async function listConfigKeys(request, env) {
  const authError = verifyAdminToken(request, env);
  if (authError)
    return authError;
  const listed = await env.KELLOGG_FRONTEND_CONFIG.list();
  return jsonResponse({ keys: listed.keys.map((k) => k.name) }, env);
}
__name(listConfigKeys, "listConfigKeys");
async function batchGetConfig(request, env) {
  const { keys } = await request.json();
  if (!keys || !Array.isArray(keys))
    return errorResponse("\u7F3A\u5C11 keys", env, 400);
  const results = {};
  for (const key of keys) {
    const val = await env.KELLOGG_FRONTEND_CONFIG.get(key, "json");
    if (val)
      results[key] = val;
  }
  return jsonResponse(results, env);
}
__name(batchGetConfig, "batchGetConfig");

// src/routes/inquiries.ts
async function submitInquiry(request, env) {
  const input = await request.json();
  if (!input.name || !input.email || !input.message) {
    return errorResponse("\u59D3\u540D\u3001\u90AE\u7BB1\u548C\u6D88\u606F\u5185\u5BB9\u4E3A\u5FC5\u586B\u9879", env, 400);
  }
  try {
    await env.DB.prepare(
      `INSERT INTO inquiries (name, email, phone, country, company, product_type, quantity, message, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
    ).bind(
      input.name,
      input.email,
      input.phone || null,
      input.country || null,
      input.company || null,
      input.product_type || null,
      input.quantity || null,
      input.message
    ).run();
    return jsonResponse({ message: "\u8BE2\u76D8\u5DF2\u63D0\u4EA4\uFF0C\u6211\u4EEC\u4F1A\u5C3D\u5FEB\u4E0E\u60A8\u8054\u7CFB" }, env, 201);
  } catch (err) {
    console.error("Submit inquiry failed:", err);
    return errorResponse("\u63D0\u4EA4\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5", env, 500);
  }
}
__name(submitInquiry, "submitInquiry");
async function getInquiries(request, env) {
  const authError = verifyAdminToken(request, env);
  if (authError)
    return authError;
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20");
  const status = url.searchParams.get("status");
  let whereClauses = [];
  let params = [];
  if (status) {
    whereClauses.push("status = ?");
    params.push(status);
  }
  const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
  const offset = (page - 1) * pageSize;
  const totalRes = await env.DB.prepare(`SELECT COUNT(*) as count FROM inquiries ${whereString}`).bind(...params).first();
  const total = totalRes?.count || 0;
  const results = await env.DB.prepare(
    `SELECT * FROM inquiries ${whereString} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, pageSize, offset).all();
  return paginatedResponse(results.results, page, pageSize, total, env, request);
}
__name(getInquiries, "getInquiries");
async function updateInquiryStatus(request, env, id) {
  const authError = verifyAdminToken(request, env);
  if (authError)
    return authError;
  const { status } = await request.json();
  if (!["pending", "processed"].includes(status)) {
    return errorResponse("\u65E0\u6548\u7684\u72B6\u6001\u503C", env, 400);
  }
  await env.DB.prepare("UPDATE inquiries SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(status, id).run();
  return jsonResponse({ message: "\u72B6\u6001\u66F4\u65B0\u6210\u529F" }, env);
}
__name(updateInquiryStatus, "updateInquiryStatus");
async function deleteInquiry(request, env, id) {
  const authError = verifyAdminToken(request, env);
  if (authError)
    return authError;
  await env.DB.prepare("DELETE FROM inquiries WHERE id = ?").bind(id).run();
  return jsonResponse({ message: "\u8BE2\u76D8\u5DF2\u5220\u9664" }, env);
}
__name(deleteInquiry, "deleteInquiry");

// src/routes/blogs.ts
function transformBlog(row) {
  return {
    id: row.id,
    slug: row.slug,
    title_zh: row.title_zh,
    title_en: row.title_en,
    summary_zh: row.summary_zh,
    summary_en: row.summary_en,
    content_zh: row.content_zh,
    content_en: row.content_en,
    cover_image: row.cover_image,
    category: row.category,
    tags: safeParseJson(row.tags, []),
    author: row.author,
    status: row.status,
    seo_title_zh: row.seo_title_zh,
    seo_title_en: row.seo_title_en,
    seo_desc_zh: row.seo_desc_zh,
    seo_desc_en: row.seo_desc_en,
    publish_date: row.publish_date,
    view_count: row.view_count,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}
__name(transformBlog, "transformBlog");
function transformBlogSummary(row) {
  const full = transformBlog(row);
  const { content_zh, content_en, ...summary } = full;
  return summary;
}
__name(transformBlogSummary, "transformBlogSummary");
function safeParseJson(val, fallback = null) {
  if (!val)
    return fallback;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}
__name(safeParseJson, "safeParseJson");
async function getBlogs(request, env) {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get("pageSize") || "10")));
  const category = url.searchParams.get("category");
  const tag = url.searchParams.get("tag");
  const sort = url.searchParams.get("sort") || "newest";
  const authError = verifyAdminToken(request, env);
  const isAdmin = !authError && !!env.ADMIN_TOKEN;
  const whereClauses = [];
  const params = [];
  if (!isAdmin) {
    whereClauses.push("status = 'published'");
  } else {
    const status = url.searchParams.get("status");
    if (status) {
      whereClauses.push("status = ?");
      params.push(status);
    }
  }
  if (category && category !== "all") {
    whereClauses.push("category = ?");
    params.push(category);
  }
  if (tag) {
    whereClauses.push(`tags LIKE ?`);
    params.push(`%"${tag}"%`);
  }
  const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
  let orderBy = "publish_date DESC, created_at DESC";
  if (sort === "popular")
    orderBy = "view_count DESC, publish_date DESC";
  else if (sort === "oldest")
    orderBy = "publish_date ASC, created_at ASC";
  const offset = (page - 1) * pageSize;
  const totalRes = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM blogs ${whereString}`
  ).bind(...params).first();
  const total = totalRes?.count || 0;
  const rows = await env.DB.prepare(
    `SELECT id, slug, title_zh, title_en, summary_zh, summary_en, cover_image, category, tags, author, status, publish_date, view_count, created_at, updated_at
     FROM blogs ${whereString} ORDER BY ${orderBy} LIMIT ? OFFSET ?`
  ).bind(...params, pageSize, offset).all();
  const data = (rows.results || []).map(transformBlogSummary);
  return paginatedResponse(data, page, pageSize, total, env, request);
}
__name(getBlogs, "getBlogs");
async function getBlog(request, env, idOrSlug) {
  const authError = verifyAdminToken(request, env);
  const isAdmin = !authError && !!env.ADMIN_TOKEN;
  let row = null;
  if (/^\d+$/.test(idOrSlug)) {
    row = await env.DB.prepare("SELECT * FROM blogs WHERE id = ?").bind(idOrSlug).first();
  } else {
    row = await env.DB.prepare("SELECT * FROM blogs WHERE slug = ?").bind(idOrSlug).first();
  }
  if (!row)
    return errorResponse("\u6587\u7AE0\u4E0D\u5B58\u5728", env, 404);
  if (!isAdmin && row.status !== "published") {
    return errorResponse("\u6587\u7AE0\u4E0D\u5B58\u5728\u6216\u672A\u53D1\u5E03", env, 404);
  }
  if (!isAdmin) {
    env.DB.prepare("UPDATE blogs SET view_count = view_count + 1 WHERE id = ?").bind(row.id).run().catch(() => {
    });
  }
  return jsonResponse(transformBlog(row), env, 200, request);
}
__name(getBlog, "getBlog");
async function createBlog(request, env) {
  const authError = verifyAdminToken(request, env);
  if (authError)
    return authError;
  const input = await request.json();
  if (!input.slug || !input.title_zh || !input.title_en) {
    return errorResponse("\u5FC5\u586B\u9879\u7F3A\u5931: slug, title_zh, title_en", env, 400);
  }
  if (!/^[a-z0-9-]+$/.test(input.slug)) {
    return errorResponse("Slug \u53EA\u80FD\u5305\u542B\u5C0F\u5199\u5B57\u6BCD\u3001\u6570\u5B57\u548C\u8FDE\u5B57\u7B26", env, 400);
  }
  const tagsJson = JSON.stringify(Array.isArray(input.tags) ? input.tags : []);
  try {
    const result = await env.DB.prepare(
      `INSERT INTO blogs (slug, title_zh, title_en, summary_zh, summary_en, content_zh, content_en,
        cover_image, category, tags, author, status, seo_title_zh, seo_title_en, seo_desc_zh, seo_desc_en, publish_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      input.slug,
      input.title_zh,
      input.title_en,
      input.summary_zh || null,
      input.summary_en || null,
      input.content_zh || "",
      input.content_en || "",
      input.cover_image || null,
      input.category || null,
      tagsJson,
      input.author || "Admin",
      input.status || "draft",
      input.seo_title_zh || null,
      input.seo_title_en || null,
      input.seo_desc_zh || null,
      input.seo_desc_en || null,
      input.publish_date || null
    ).run();
    await markChangesPending(env);
    return jsonResponse({ id: result.meta.last_row_id, message: "\u521B\u5EFA\u6210\u529F" }, env, 201);
  } catch (err) {
    if (err?.message?.includes("UNIQUE")) {
      return errorResponse(`Slug "${input.slug}" \u5DF2\u5B58\u5728\uFF0C\u8BF7\u66F4\u6362`, env, 409);
    }
    throw err;
  }
}
__name(createBlog, "createBlog");
async function updateBlog(request, env, id) {
  const authError = verifyAdminToken(request, env);
  if (authError)
    return authError;
  const blogId = parseInt(id);
  const existing = await env.DB.prepare("SELECT id FROM blogs WHERE id = ?").bind(blogId).first();
  if (!existing)
    return errorResponse("\u6587\u7AE0\u4E0D\u5B58\u5728", env, 404);
  const input = await request.json();
  const updates = [];
  const params = [];
  const textFields = [
    "slug",
    "title_zh",
    "title_en",
    "summary_zh",
    "summary_en",
    "content_zh",
    "content_en",
    "cover_image",
    "category",
    "author",
    "status",
    "seo_title_zh",
    "seo_title_en",
    "seo_desc_zh",
    "seo_desc_en",
    "publish_date"
  ];
  textFields.forEach((field) => {
    if (field in input) {
      updates.push(`${field} = ?`);
      params.push(input[field] ?? null);
    }
  });
  if ("tags" in input) {
    updates.push("tags = ?");
    params.push(JSON.stringify(Array.isArray(input.tags) ? input.tags : []));
  }
  if (updates.length === 0) {
    return errorResponse("\u6CA1\u6709\u53EF\u66F4\u65B0\u7684\u5B57\u6BB5", env, 400);
  }
  params.push(blogId);
  await env.DB.prepare(
    `UPDATE blogs SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(...params).run();
  await markChangesPending(env);
  return jsonResponse({ message: "\u66F4\u65B0\u6210\u529F" }, env);
}
__name(updateBlog, "updateBlog");
async function deleteBlog(request, env, id) {
  const authError = verifyAdminToken(request, env);
  if (authError)
    return authError;
  const blogId = parseInt(id);
  const existing = await env.DB.prepare("SELECT id FROM blogs WHERE id = ?").bind(blogId).first();
  if (!existing)
    return errorResponse("\u6587\u7AE0\u4E0D\u5B58\u5728", env, 404);
  await env.DB.prepare("DELETE FROM blogs WHERE id = ?").bind(blogId).run();
  await markChangesPending(env);
  return jsonResponse({ message: "\u5220\u9664\u6210\u529F" }, env);
}
__name(deleteBlog, "deleteBlog");

// src/routes/blogCategories.ts
function toSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").substring(0, 80);
}
__name(toSlug, "toSlug");
async function getBlogCategories(request, env) {
  const rows = await env.DB.prepare(`
    SELECT
      bc.*,
      COUNT(b.id) as article_count
    FROM blog_categories bc
    LEFT JOIN blogs b ON b.category = bc.name_en
    GROUP BY bc.id
    ORDER BY bc.sort_order ASC, bc.created_at ASC
  `).all();
  return jsonResponse(rows.results || [], env, 200, request);
}
__name(getBlogCategories, "getBlogCategories");
async function createBlogCategory(request, env) {
  const authError = verifyAdminToken(request, env);
  if (authError)
    return authError;
  const input = await request.json();
  if (!input.name_zh || !input.name_en) {
    return errorResponse("\u7F3A\u5C11\u5FC5\u586B\u5B57\u6BB5\uFF1Aname_zh \u548C name_en", env, 400);
  }
  const slug = input.slug || toSlug(input.name_en);
  const existing = await env.DB.prepare(
    "SELECT id FROM blog_categories WHERE slug = ?"
  ).bind(slug).first();
  if (existing) {
    return errorResponse(`Slug "${slug}" \u5DF2\u5B58\u5728\uFF0C\u8BF7\u66F4\u6362\u540D\u79F0\u6216\u624B\u52A8\u6307\u5B9A slug`, env, 409);
  }
  const maxOrder = await env.DB.prepare(
    "SELECT MAX(sort_order) as max_order FROM blog_categories"
  ).first();
  const sortOrder = input.sort_order ?? (maxOrder?.max_order ?? 0) + 1;
  const result = await env.DB.prepare(`
    INSERT INTO blog_categories (name_zh, name_en, slug, sort_order)
    VALUES (?, ?, ?, ?)
  `).bind(input.name_zh, input.name_en, slug, sortOrder).run();
  return jsonResponse({ id: result.meta?.last_row_id, message: "\u5206\u7C7B\u521B\u5EFA\u6210\u529F" }, env, 201);
}
__name(createBlogCategory, "createBlogCategory");
async function updateBlogCategory(request, env, id) {
  const authError = verifyAdminToken(request, env);
  if (authError)
    return authError;
  const categoryId = parseInt(id, 10);
  if (isNaN(categoryId))
    return errorResponse("\u65E0\u6548\u7684\u5206\u7C7B ID", env, 400);
  const current = await env.DB.prepare(
    "SELECT * FROM blog_categories WHERE id = ?"
  ).bind(categoryId).first();
  if (!current)
    return errorResponse(`\u5206\u7C7B ID ${id} \u4E0D\u5B58\u5728`, env, 404);
  const input = await request.json();
  const newNameZh = input.name_zh ?? current.name_zh;
  const newNameEn = input.name_en ?? current.name_en;
  const newSlug = input.slug ?? (input.name_en ? toSlug(input.name_en) : current.slug);
  const newSortOrder = input.sort_order ?? current.sort_order;
  if (newSlug !== current.slug) {
    const slugConflict = await env.DB.prepare(
      "SELECT id FROM blog_categories WHERE slug = ? AND id != ?"
    ).bind(newSlug, categoryId).first();
    if (slugConflict) {
      return errorResponse(`Slug "${newSlug}" \u5DF2\u88AB\u5176\u4ED6\u5206\u7C7B\u4F7F\u7528`, env, 409);
    }
  }
  await env.DB.prepare(`
    UPDATE blog_categories
    SET name_zh = ?, name_en = ?, slug = ?, sort_order = ?
    WHERE id = ?
  `).bind(newNameZh, newNameEn, newSlug, newSortOrder, categoryId).run();
  if (newNameEn !== current.name_en) {
    const cascadeResult = await env.DB.prepare(`
      UPDATE blogs
      SET category = ?, updated_at = CURRENT_TIMESTAMP
      WHERE category = ?
    `).bind(newNameEn, current.name_en).run();
    console.log(`[BlogCategory] Cascade updated ${cascadeResult.meta?.changes ?? 0} articles from "${current.name_en}" to "${newNameEn}"`);
  }
  await markChangesPending(env);
  return jsonResponse({ message: "\u5206\u7C7B\u66F4\u65B0\u6210\u529F" }, env);
}
__name(updateBlogCategory, "updateBlogCategory");
async function deleteBlogCategory(request, env, id) {
  const authError = verifyAdminToken(request, env);
  if (authError)
    return authError;
  const categoryId = parseInt(id, 10);
  if (isNaN(categoryId))
    return errorResponse("\u65E0\u6548\u7684\u5206\u7C7B ID", env, 400);
  const category = await env.DB.prepare(
    "SELECT * FROM blog_categories WHERE id = ?"
  ).bind(categoryId).first();
  if (!category)
    return errorResponse(`\u5206\u7C7B ID ${id} \u4E0D\u5B58\u5728`, env, 404);
  const usageCount = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM blogs WHERE category = ?"
  ).bind(category.name_en).first();
  if (usageCount && usageCount.count > 0) {
    return errorResponse(
      `\u65E0\u6CD5\u5220\u9664\uFF1A\u8BE5\u5206\u7C7B\u4E0B\u6709 ${usageCount.count} \u7BC7\u6587\u7AE0\uFF0C\u8BF7\u5148\u5C06\u8FD9\u4E9B\u6587\u7AE0\u79FB\u81F3\u5176\u4ED6\u5206\u7C7B\u540E\u518D\u5220\u9664\u3002`,
      env,
      409
    );
  }
  await env.DB.prepare("DELETE FROM blog_categories WHERE id = ?").bind(categoryId).run();
  return jsonResponse({ message: "\u5206\u7C7B\u5220\u9664\u6210\u529F" }, env);
}
__name(deleteBlogCategory, "deleteBlogCategory");

// src/routes/caseStudies.ts
function transformCaseStudy(row) {
  return {
    id: row.id,
    client_name: row.client_name,
    country: row.country,
    rating: row.rating,
    media_type: row.media_type,
    media_url: row.media_url,
    review_text_zh: row.review_text_zh,
    review_text_en: row.review_text_en,
    sort_order: row.sort_order,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}
__name(transformCaseStudy, "transformCaseStudy");
async function getCaseStudies(request, env) {
  const rows = await env.DB.prepare(
    `SELECT * FROM case_studies
     WHERE status = 'published'
     ORDER BY sort_order DESC, created_at DESC`
  ).all();
  return jsonResponse((rows.results || []).map(transformCaseStudy), env, 200, request);
}
__name(getCaseStudies, "getCaseStudies");
async function getAdminCaseStudies(request, env) {
  const authError = verifyAdminToken(request, env);
  if (authError)
    return authError;
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get("pageSize") || "20")));
  const search = url.searchParams.get("search") || "";
  const status = url.searchParams.get("status") || "";
  const whereClauses = [];
  const params = [];
  if (status && (status === "published" || status === "draft")) {
    whereClauses.push("status = ?");
    params.push(status);
  }
  if (search) {
    whereClauses.push("(client_name LIKE ? OR country LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
  const offset = (page - 1) * pageSize;
  const totalRes = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM case_studies ${whereString}`
  ).bind(...params).first();
  const total = totalRes?.count || 0;
  const rows = await env.DB.prepare(
    `SELECT * FROM case_studies ${whereString}
     ORDER BY sort_order DESC, created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(...params, pageSize, offset).all();
  const data = (rows.results || []).map(transformCaseStudy);
  return paginatedResponse(data, page, pageSize, total, env, request);
}
__name(getAdminCaseStudies, "getAdminCaseStudies");
async function createCaseStudy(request, env) {
  const authError = verifyAdminToken(request, env);
  if (authError)
    return authError;
  const input = await request.json();
  if (!input.client_name?.trim()) {
    return errorResponse("\u5FC5\u586B\u9879\u7F3A\u5931: client_name", env, 400);
  }
  if (!input.media_url?.trim()) {
    return errorResponse("\u5FC5\u586B\u9879\u7F3A\u5931: media_url", env, 400);
  }
  if (!input.review_text_zh?.trim() || !input.review_text_en?.trim()) {
    return errorResponse("\u5FC5\u586B\u9879\u7F3A\u5931: review_text_zh \u548C review_text_en", env, 400);
  }
  if (!["video", "image"].includes(input.media_type)) {
    return errorResponse("media_type \u5FC5\u987B\u4E3A video \u6216 image", env, 400);
  }
  const rating = Math.min(5, Math.max(1, parseFloat(String(input.rating ?? 5))));
  const maxOrder = await env.DB.prepare(
    "SELECT MAX(sort_order) as max_order FROM case_studies"
  ).first();
  const sortOrder = input.sort_order ?? (maxOrder?.max_order ?? 0) + 1;
  const result = await env.DB.prepare(
    `INSERT INTO case_studies
       (client_name, country, rating, media_type, media_url, review_text_zh, review_text_en, sort_order, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    input.client_name.trim(),
    input.country?.trim() || null,
    rating,
    input.media_type,
    input.media_url.trim(),
    input.review_text_zh.trim(),
    input.review_text_en.trim(),
    sortOrder,
    input.status || "published"
  ).run();
  await markChangesPending(env);
  return jsonResponse({ id: result.meta?.last_row_id, message: "\u521B\u5EFA\u6210\u529F" }, env, 201);
}
__name(createCaseStudy, "createCaseStudy");
async function updateCaseStudy(request, env, id) {
  const authError = verifyAdminToken(request, env);
  if (authError)
    return authError;
  const caseStudyId = parseInt(id, 10);
  if (isNaN(caseStudyId))
    return errorResponse("\u65E0\u6548\u7684 ID", env, 400);
  const existing = await env.DB.prepare(
    "SELECT id FROM case_studies WHERE id = ?"
  ).bind(caseStudyId).first();
  if (!existing)
    return errorResponse(`\u6848\u4F8B ID ${id} \u4E0D\u5B58\u5728`, env, 404);
  const input = await request.json();
  const updates = [];
  const params = [];
  const fieldMap = {
    client_name: input.client_name?.trim(),
    country: input.country?.trim() || null,
    rating: input.rating !== void 0 ? Math.min(5, Math.max(1, parseFloat(String(input.rating)))) : void 0,
    media_type: input.media_type,
    media_url: input.media_url?.trim(),
    review_text_zh: input.review_text_zh?.trim(),
    review_text_en: input.review_text_en?.trim(),
    sort_order: input.sort_order,
    status: input.status
  };
  Object.entries(fieldMap).forEach(([key, val]) => {
    if (val !== void 0) {
      updates.push(`${key} = ?`);
      params.push(val);
    }
  });
  if (updates.length === 0) {
    return errorResponse("\u6CA1\u6709\u53EF\u66F4\u65B0\u7684\u5B57\u6BB5", env, 400);
  }
  params.push(caseStudyId);
  await env.DB.prepare(
    `UPDATE case_studies SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(...params).run();
  await markChangesPending(env);
  return jsonResponse({ message: "\u66F4\u65B0\u6210\u529F" }, env);
}
__name(updateCaseStudy, "updateCaseStudy");
async function deleteCaseStudy(request, env, id) {
  const authError = verifyAdminToken(request, env);
  if (authError)
    return authError;
  const caseStudyId = parseInt(id, 10);
  if (isNaN(caseStudyId))
    return errorResponse("\u65E0\u6548\u7684 ID", env, 400);
  const existing = await env.DB.prepare(
    "SELECT id FROM case_studies WHERE id = ?"
  ).bind(caseStudyId).first();
  if (!existing)
    return errorResponse(`\u6848\u4F8B ID ${id} \u4E0D\u5B58\u5728`, env, 404);
  await env.DB.prepare("DELETE FROM case_studies WHERE id = ?").bind(caseStudyId).run();
  await markChangesPending(env);
  return jsonResponse({ message: "\u5220\u9664\u6210\u529F" }, env);
}
__name(deleteCaseStudy, "deleteCaseStudy");

// src/tasks/gc.ts
async function runGarbageCollection(env) {
  console.log("[GC] Starting Garbage Collection for R2 Assets...");
  try {
    const productsRes = await env.DB.prepare("SELECT image FROM products WHERE image IS NOT NULL").all();
    const categoriesRes = await env.DB.prepare("SELECT image FROM categories WHERE image IS NOT NULL").all();
    const productImagesRes = await env.DB.prepare("SELECT image_key FROM product_images").all();
    const d1Strings = [
      ...productsRes.results.map((r) => r.image),
      ...categoriesRes.results.map((r) => r.image),
      ...productImagesRes.results.map((r) => r.image_key)
    ].join("|||");
    const keysToFetch = ["pages", "pages_index", "site_settings", "header_config", "footer_config"];
    let kvStrings = "";
    for (const k of keysToFetch) {
      const val = await env.KELLOGG_FRONTEND_CONFIG.get(k);
      if (val)
        kvStrings += val + "|||";
    }
    let kvCursor = void 0;
    let listComplete = false;
    do {
      const listedKeys = await env.KELLOGG_FRONTEND_CONFIG.list({ prefix: "page:", cursor: kvCursor });
      for (const key of listedKeys.keys) {
        const val = await env.KELLOGG_FRONTEND_CONFIG.get(key.name);
        if (val)
          kvStrings += val + "|||";
      }
      listComplete = listedKeys.list_complete;
      kvCursor = listedKeys.cursor;
    } while (!listComplete);
    const allReferencesText = d1Strings + "|||" + kvStrings;
    let truncated = false;
    let cursor = void 0;
    let deletedCount = 0;
    const oneDayAgo = /* @__PURE__ */ new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const oneDayAgoMs = oneDayAgo.getTime();
    do {
      const listParams = { limit: 50 };
      if (cursor)
        listParams.cursor = cursor;
      const listed = await env.ASSETS.list(listParams);
      for (const obj of listed.objects) {
        if (!obj.key.startsWith("uploads/"))
          continue;
        const uploadedTime = new Date(obj.uploaded).getTime();
        if (uploadedTime > oneDayAgoMs) {
          continue;
        }
        const filename = obj.key.replace("uploads/", "");
        const encodedFilename = encodeURIComponent(filename);
        const isReferenced = allReferencesText.includes(obj.key) || allReferencesText.includes(filename) || allReferencesText.includes(encodedFilename);
        if (!isReferenced) {
          console.log(`[GC] Deleting orphaned file: ${obj.key}`);
          await env.ASSETS.delete(obj.key);
          deletedCount++;
        }
      }
      truncated = listed.truncated;
      cursor = listed.truncated ? listed.cursor : void 0;
    } while (truncated);
    console.log(`[GC] Garbage Collection completed. Deleted ${deletedCount} orphaned files.`);
  } catch (err) {
    console.error("[GC] Error running Garbage Collection:", err);
  }
}
__name(runGarbageCollection, "runGarbageCollection");

// src/routes/index.ts
var routes = [
  // ============================================
  // 公开 API (GET)
  // ============================================
  // 静态媒体资源代理 (图片/视频/资源)
  { method: "GET", pattern: /^\/uploads\/(.+)$/, handler: (req, env, p) => serveMedia(req, env, p.id || "") },
  { method: "GET", pattern: /^\/api\/image\/(.+)$/, handler: (req, env, p) => serveOptimizedMedia(req, env, p.id || "") },
  { method: "GET", pattern: /^\/api\/media\/optimized\/(.+)$/, handler: (req, env, p) => serveOptimizedMedia(req, env, p.id || "") },
  { method: "GET", pattern: /^\/api\/media\/(.+)$/, handler: (req, env, p) => serveMedia(req, env, p.id || "") },
  // 产品
  { method: "GET", pattern: /^\/api\/products$/, handler: (req, env) => getProducts(req, env) },
  { method: "GET", pattern: /^\/api\/products\/(\d+)$/, handler: (req, env, p) => getProduct(req, env, p.id) },
  // 分类
  { method: "GET", pattern: /^\/api\/categories$/, handler: (req, env) => getCategories(req, env) },
  { method: "GET", pattern: /^\/api\/categories\/([^/]+)$/, handler: (req, env, p) => getCategory(req, env, p.id) },
  // 站点与页面配置 (积木系统核心)
  { method: "GET", pattern: /^\/api\/config\/site_settings$/, handler: (req, env) => getSiteSettings(req, env) },
  { method: "GET", pattern: /^\/api\/config\/site-settings$/, handler: (req, env) => getSiteSettings(req, env) },
  // 兼容旧版
  { method: "GET", pattern: /^\/api\/config\/pages$/, handler: (req, env) => getPages(req, env) },
  { method: "GET", pattern: /^\/api\/config\/pages\/([^/]+)$/, handler: (req, env, p) => getPageById(req, env, p.id) },
  { method: "GET", pattern: /^\/api\/pages$/, handler: (req, env) => getPages(req, env) },
  // 别名
  { method: "GET", pattern: /^\/api\/pages\/([^/]+)$/, handler: (req, env, p) => getPageById(req, env, p.id) },
  // 别名
  // 询盘提交
  { method: "POST", pattern: /^\/api\/inquiries\/submit$/, handler: (req, env) => submitInquiry(req, env) },
  { method: "POST", pattern: /^\/api\/inquiries$/, handler: (req, env) => submitInquiry(req, env) },
  // 兼容别名
  // 博客文章 (公开)
  { method: "GET", pattern: /^\/api\/blogs$/, handler: (req, env) => getBlogs(req, env) },
  { method: "GET", pattern: /^\/api\/blogs\/([^/]+)$/, handler: (req, env, p) => getBlog(req, env, p.id) },
  // 博客分类 (公开)
  { method: "GET", pattern: /^\/api\/blog-categories$/, handler: (req, env) => getBlogCategories(req, env) },
  // 客户案例 (公开)
  { method: "GET", pattern: /^\/api\/case-studies$/, handler: (req, env) => getCaseStudies(req, env) },
  // ============================================
  // 管理 API (需要认证，POST/PUT/DELETE)
  // ============================================
  // 商品管理
  { method: "POST", pattern: /^\/api\/products$/, handler: (req, env) => createProduct(req, env) },
  { method: "PUT", pattern: /^\/api\/products\/(\d+)$/, handler: (req, env, p) => updateProduct(req, env, p.id) },
  { method: "DELETE", pattern: /^\/api\/products\/(\d+)$/, handler: (req, env, p) => deleteProduct(req, env, p.id) },
  // 分类管理
  { method: "POST", pattern: /^\/api\/categories$/, handler: (req, env) => createCategory(req, env) },
  { method: "PUT", pattern: /^\/api\/categories\/([^/]+)$/, handler: (req, env, p) => updateCategory(req, env, p.id) },
  { method: "DELETE", pattern: /^\/api\/categories\/([^/]+)$/, handler: (req, env, p) => deleteCategory(req, env, p.id) },
  // 询盘管理
  { method: "GET", pattern: /^\/api\/inquiries$/, handler: (req, env) => getInquiries(req, env) },
  { method: "PATCH", pattern: /^\/api\/inquiries\/(\d+)$/, handler: (req, env, p) => updateInquiryStatus(req, env, p.id) },
  { method: "DELETE", pattern: /^\/api\/inquiries\/(\d+)$/, handler: (req, env, p) => deleteInquiry(req, env, p.id) },
  // 博客管理
  { method: "POST", pattern: /^\/api\/blogs$/, handler: (req, env) => createBlog(req, env) },
  { method: "PUT", pattern: /^\/api\/blogs\/(\d+)$/, handler: (req, env, p) => updateBlog(req, env, p.id) },
  { method: "DELETE", pattern: /^\/api\/blogs\/(\d+)$/, handler: (req, env, p) => deleteBlog(req, env, p.id) },
  // 博客分类管理
  { method: "POST", pattern: /^\/api\/blog-categories$/, handler: (req, env) => createBlogCategory(req, env) },
  { method: "PUT", pattern: /^\/api\/blog-categories\/(\d+)$/, handler: (req, env, p) => updateBlogCategory(req, env, p.id) },
  { method: "DELETE", pattern: /^\/api\/blog-categories\/(\d+)$/, handler: (req, env, p) => deleteBlogCategory(req, env, p.id) },
  // 客户案例管理
  { method: "GET", pattern: /^\/api\/admin\/case-studies$/, handler: (req, env) => getAdminCaseStudies(req, env) },
  { method: "POST", pattern: /^\/api\/admin\/case-studies$/, handler: (req, env) => createCaseStudy(req, env) },
  { method: "PUT", pattern: /^\/api\/admin\/case-studies\/(\d+)$/, handler: (req, env, p) => updateCaseStudy(req, env, p.id) },
  { method: "DELETE", pattern: /^\/api\/admin\/case-studies\/(\d+)$/, handler: (req, env, p) => deleteCaseStudy(req, env, p.id) },
  // 文件上传
  { method: "POST", pattern: /^\/api\/upload$/, handler: (req, env) => uploadImage(req, env) },
  { method: "POST", pattern: /^\/api\/upload\/batch$/, handler: (req, env) => uploadImages(req, env) },
  { method: "DELETE", pattern: /^\/api\/upload$/, handler: (req, env) => deleteImage(req, env) },
  { method: "GET", pattern: /^\/api\/upload\/list$/, handler: (req, env) => listImages(req, env) },
  // 通用配置 KV 管理接口 (如保存 blocks / headers)
  { method: "GET", pattern: /^\/api\/config\/keys$/, handler: (req, env) => listConfigKeys(req, env) },
  { method: "GET", pattern: /^\/api\/config\/([^/]+)$/, handler: (req, env, p) => getConfig(req, env, p.id) },
  { method: "POST", pattern: /^\/api\/config\/batch$/, handler: (req, env) => batchGetConfig(req, env) },
  { method: "POST", pattern: /^\/api\/config$/, handler: (req, env) => setConfig(req, env) },
  { method: "PUT", pattern: /^\/api\/config\/pages$/, handler: (req, env) => updatePages(req, env) },
  { method: "PUT", pattern: /^\/api\/config\/site_settings$/, handler: (req, env) => updateSiteSettings(req, env) },
  { method: "DELETE", pattern: /^\/api\/config\/([^/]+)$/, handler: (req, env, p) => deleteConfig(req, env, p.id) },
  // GC 手动触发 (测试用/后台按钮用)
  { method: "POST", pattern: /^\/api\/system\/gc$/, handler: async (req, env) => {
    const authError = req.headers.get("Authorization") === `Bearer ${env.ADMIN_TOKEN}` ? null : new Response("Unauthorized", { status: 401 });
    if (authError)
      return authError;
    await runGarbageCollection(env);
    return new Response(JSON.stringify({ message: "Garbage Collection started/completed" }), { headers: { "Content-Type": "application/json" } });
  } },
  // 手动触发汇率更新 API (测试用/后台按钮用)
  { method: "POST", pattern: /^\/api\/system\/update-rates$/, handler: async (req, env) => {
    if (env.ADMIN_TOKEN) {
      const authError = req.headers.get("Authorization") === `Bearer ${env.ADMIN_TOKEN}` ? null : new Response("Unauthorized", { status: 401 });
      if (authError)
        return authError;
    }
    await fetchExchangeRates(env);
    return new Response(JSON.stringify({ message: "Exchange rates updated" }), { headers: { "Content-Type": "application/json" } });
  } },
  // 主动触发构建 API
  { method: "POST", pattern: /^\/api\/system\/trigger-build$/, handler: (req, env) => triggerBuild(req, env) },
  // 数据初始化 API
  { method: "POST", pattern: /^\/api\/system\/init-kv$/, handler: (req, env) => initKV(req, env) }
];

// src/index.ts
var src_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return optionsResponse(env);
    }
    try {
      for (const route of routes) {
        if (route.method === request.method || route.method === "ANY") {
          const match = url.pathname.match(route.pattern);
          if (match) {
            const params = {};
            if (match.length > 1) {
              params.id = match[1];
            }
            return await route.handler(request, env, params);
          }
        }
      }
      return errorResponse(`\u8DEF\u7531\u672A\u627E\u5230: ${request.method} ${url.pathname}`, env, 404);
    } catch (err) {
      console.error(err);
      return errorResponse("\u5185\u90E8\u670D\u52A1\u5668\u9519\u8BEF", env, 500);
    }
  },
  // 定时任务入口 (Cron Triggers)
  async scheduled(event, env, ctx) {
    console.log(`[Cron] Scheduled execution triggering: ${event.cron}`);
    if (event.cron === "* * * * *" || event.cron === "0 0 * * *" || event.cron.includes("0 0")) {
      ctx.waitUntil(fetchExchangeRates(env));
    }
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-77xaZa/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-77xaZa/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
