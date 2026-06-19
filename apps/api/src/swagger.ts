import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import type { Express } from "express";
import { env } from "./env.js";

const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "IntiTrade API",
      version: "0.1.0",
      description: "Backend API for the university marketplace: auth, listings, uploads, favorites, realtime chat, reports, and admin moderation."
    },
    servers: [
      { url: env.API_URL, description: "Configured API URL" },
      { url: `http://localhost:${env.PORT}`, description: "Local API" }
    ],
    tags: [
      { name: "Health" },
      { name: "Auth" },
      { name: "Listings" },
      { name: "Uploads" },
      { name: "Favorites" },
      { name: "Conversations" },
      { name: "Reports" },
      { name: "Admin" }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          properties: {
            message: { type: "string", example: "Authentication required" }
          }
        },
        User: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            email: { type: "string", example: "student@gmail.com" },
            name: { type: "string", example: "Diana A." },
            role: { type: "string", enum: ["STUDENT", "ADMIN"] },
            isVerified: { type: "boolean" },
            isBlocked: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" }
          }
        },
        Category: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string", example: "Electronics" },
            slug: { type: "string", example: "electronics" }
          }
        },
        Listing: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            title: { type: "string", example: "MacBook Air M1 for coursework" },
            description: { type: "string" },
            price: { type: "string", example: "520.00" },
            type: { type: "string", enum: ["PRODUCT", "SERVICE"] },
            condition: { type: "string", enum: ["NEW", "LIKE_NEW", "GOOD", "FAIR", "NOT_APPLICABLE"] },
            status: { type: "string", enum: ["PENDING", "ACTIVE", "SOLD", "ARCHIVED", "REJECTED"] },
            location: { type: "string", example: "Main Library" },
            seller: { $ref: "#/components/schemas/User" },
            category: { $ref: "#/components/schemas/Category" },
            images: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  url: { type: "string", example: "/uploads/image.jpg" }
                }
              }
            }
          }
        },
        Conversation: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            listing: { $ref: "#/components/schemas/Listing" },
            buyer: { $ref: "#/components/schemas/User" },
            seller: { $ref: "#/components/schemas/User" },
            messages: {
              type: "array",
              items: { $ref: "#/components/schemas/Message" }
            }
          }
        },
        Message: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            body: { type: "string", example: "Hi, is this still available?" },
            createdAt: { type: "string", format: "date-time" },
            sender: { $ref: "#/components/schemas/User" }
          }
        },
        RegisterRequest: {
          type: "object",
          required: ["name", "email", "password"],
          properties: {
            name: { type: "string", example: "Diana A." },
            email: { type: "string", example: "student@gmail.com" },
            password: { type: "string", example: "Student12345!" }
          }
        },
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", example: "student@gmail.com" },
            password: { type: "string", example: "Student12345!" }
          }
        },
        ListingCreateRequest: {
          type: "object",
          required: ["title", "description", "price", "type", "location", "categoryId"],
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            price: { type: "number", example: 35 },
            type: { type: "string", enum: ["PRODUCT", "SERVICE"] },
            condition: { type: "string", enum: ["NEW", "LIKE_NEW", "GOOD", "FAIR", "NOT_APPLICABLE"] },
            location: { type: "string" },
            categoryId: { type: "string", format: "uuid" },
            imageUrls: { type: "array", items: { type: "string" } }
          }
        }
      },
      paths: {
        "/api/health": {
          get: {
            tags: ["Health"],
            summary: "Check API health",
            responses: {
              200: { description: "API is running" }
            }
          }
        },
        "/api/auth/register": {
          post: {
            tags: ["Auth"],
            summary: "Register a student account",
            requestBody: {
              required: true,
              content: { "application/json": { schema: { $ref: "#/components/schemas/RegisterRequest" } } }
            },
            responses: {
              201: { description: "Registration created" },
              400: { description: "Invalid domain or payload", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
            }
          }
        },
        "/api/auth/verify-email": {
          post: {
            tags: ["Auth"],
            summary: "Verify email token",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["token"],
                    properties: { token: { type: "string" } }
                  }
                }
              }
            },
            responses: {
              200: { description: "Email verified and JWT returned" },
              400: { description: "Invalid token" }
            }
          }
        },
        "/api/auth/login": {
          post: {
            tags: ["Auth"],
            summary: "Login and receive JWT",
            requestBody: {
              required: true,
              content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } }
            },
            responses: {
              200: { description: "Authenticated" },
              401: { description: "Invalid credentials" }
            }
          }
        },
        "/api/auth/me": {
          get: {
            tags: ["Auth"],
            summary: "Get current user",
            security: [{ bearerAuth: [] }],
            responses: {
              200: { description: "Current user" },
              401: { description: "Authentication required" }
            }
          }
        },
        "/api/listings/categories": {
          get: {
            tags: ["Listings"],
            summary: "List categories",
            responses: {
              200: { description: "Categories list" }
            }
          }
        },
        "/api/listings": {
          get: {
            tags: ["Listings"],
            summary: "Search active listings",
            parameters: [
              { in: "query", name: "q", schema: { type: "string" } },
              { in: "query", name: "type", schema: { type: "string", enum: ["PRODUCT", "SERVICE"] } },
              { in: "query", name: "category", schema: { type: "string" } },
              { in: "query", name: "minPrice", schema: { type: "number" } },
              { in: "query", name: "maxPrice", schema: { type: "number" } },
              { in: "query", name: "sort", schema: { type: "string", enum: ["newest", "price_asc", "price_desc"] } }
            ],
            responses: {
              200: { description: "Listings list" }
            }
          },
          post: {
            tags: ["Listings"],
            summary: "Create listing",
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: { "application/json": { schema: { $ref: "#/components/schemas/ListingCreateRequest" } } }
            },
            responses: {
              201: { description: "Listing created" },
              401: { description: "Authentication required" }
            }
          }
        },
        "/api/listings/mine": {
          get: {
            tags: ["Listings"],
            summary: "List own listings",
            security: [{ bearerAuth: [] }],
            responses: {
              200: { description: "Own listings" }
            }
          }
        },
        "/api/listings/{id}": {
          get: {
            tags: ["Listings"],
            summary: "Get listing details",
            parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } }],
            responses: {
              200: { description: "Listing details" },
              404: { description: "Listing not found" }
            }
          },
          patch: {
            tags: ["Listings"],
            summary: "Update own listing",
            security: [{ bearerAuth: [] }],
            parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } }],
            responses: {
              200: { description: "Listing updated" },
              403: { description: "Not allowed" }
            }
          }
        },
        "/api/listings/{id}/status": {
          patch: {
            tags: ["Listings"],
            summary: "Update listing lifecycle status",
            security: [{ bearerAuth: [] }],
            parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } }],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["status"],
                    properties: { status: { type: "string", enum: ["SOLD", "ARCHIVED", "ACTIVE", "REJECTED", "PENDING"] } }
                  }
                }
              }
            },
            responses: {
              200: { description: "Status updated" }
            }
          }
        },
        "/api/uploads": {
          post: {
            tags: ["Uploads"],
            summary: "Upload listing images",
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                "multipart/form-data": {
                  schema: {
                    type: "object",
                    properties: {
                      images: { type: "array", items: { type: "string", format: "binary" } }
                    }
                  }
                }
              }
            },
            responses: {
              201: { description: "Image URLs returned" }
            }
          }
        },
        "/api/favorites": {
          get: {
            tags: ["Favorites"],
            summary: "List saved listings",
            security: [{ bearerAuth: [] }],
            responses: { 200: { description: "Favorites list" } }
          }
        },
        "/api/favorites/{listingId}": {
          post: {
            tags: ["Favorites"],
            summary: "Save listing",
            security: [{ bearerAuth: [] }],
            parameters: [{ in: "path", name: "listingId", required: true, schema: { type: "string", format: "uuid" } }],
            responses: { 201: { description: "Saved" } }
          },
          delete: {
            tags: ["Favorites"],
            summary: "Remove saved listing",
            security: [{ bearerAuth: [] }],
            parameters: [{ in: "path", name: "listingId", required: true, schema: { type: "string", format: "uuid" } }],
            responses: { 204: { description: "Removed" } }
          }
        },
        "/api/conversations": {
          get: {
            tags: ["Conversations"],
            summary: "List conversations",
            security: [{ bearerAuth: [] }],
            responses: { 200: { description: "Conversation inbox" } }
          },
          post: {
            tags: ["Conversations"],
            summary: "Start conversation from listing",
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["listingId"],
                    properties: { listingId: { type: "string", format: "uuid" } }
                  }
                }
              }
            },
            responses: { 201: { description: "Conversation created or returned" } }
          }
        },
        "/api/conversations/{id}": {
          get: {
            tags: ["Conversations"],
            summary: "Get conversation thread",
            security: [{ bearerAuth: [] }],
            parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } }],
            responses: { 200: { description: "Conversation detail" } }
          }
        },
        "/api/conversations/{id}/messages": {
          post: {
            tags: ["Conversations"],
            summary: "Send message over REST",
            security: [{ bearerAuth: [] }],
            parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } }],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["body"],
                    properties: { body: { type: "string" } }
                  }
                }
              }
            },
            responses: { 201: { description: "Message sent" } }
          }
        },
        "/api/reports": {
          post: {
            tags: ["Reports"],
            summary: "Report listing",
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["listingId", "reason"],
                    properties: {
                      listingId: { type: "string", format: "uuid" },
                      reason: { type: "string" },
                      details: { type: "string" }
                    }
                  }
                }
              }
            },
            responses: { 201: { description: "Report created" } }
          }
        },
        "/api/admin/overview": {
          get: {
            tags: ["Admin"],
            summary: "Admin dashboard metrics",
            security: [{ bearerAuth: [] }],
            responses: { 200: { description: "Admin metrics" } }
          }
        },
        "/api/admin/listings": {
          get: {
            tags: ["Admin"],
            summary: "Admin listing queue",
            security: [{ bearerAuth: [] }],
            responses: { 200: { description: "All listings for moderation" } }
          }
        },
        "/api/admin/reports": {
          get: {
            tags: ["Admin"],
            summary: "Admin reports queue",
            security: [{ bearerAuth: [] }],
            responses: { 200: { description: "Reports queue" } }
          }
        }
      }
    }
  },
  apis: []
});

export function registerSwagger(app: Express) {
  app.get("/api/docs.json", (_req, res) => res.json(swaggerSpec));
  app.use(
    "/api/docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: "IntiTrade API Docs",
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true
      }
    })
  );
}
