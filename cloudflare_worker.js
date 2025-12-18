export default {
    async fetch(request, env, ctx) {
        // Handle CORS
        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Secret",
                },
            });
        }

        const url = new URL(request.url);
        const path = url.pathname;

        // Helper for JSON response
        const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), {
            status,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
        });

        // Helper for Error response
        const errorResponse = (message, status = 500) => jsonResponse({ error: message }, status);

        // 1. GET /api/data/:key (Public)
        if (request.method === "GET" && path.startsWith("/api/data/")) {
            const key = path.split("/").pop();
            const value = await env.DB.get(key);
            return jsonResponse(value ? JSON.parse(value) : null);
        }

        // 2. POST /api/data/:key (Secured with Secret)
        if (request.method === "POST" && path.startsWith("/api/data/")) {
            const secret = request.headers.get("X-Admin-Secret");
            if (secret !== env.ADMIN_SECRET) {
                return errorResponse("Unauthorized", 401);
            }

            const key = path.split("/").pop();
            try {
                const body = await request.json();
                await env.DB.put(key, JSON.stringify(body));
                return jsonResponse({ success: true });
            } catch (e) {
                return errorResponse("Invalid JSON", 400);
            }
        }

        // 3. POST /api/login
        if (request.method === "POST" && path === "/api/login") {
            try {
                const body = await request.json();
                const { username, password } = body;

                if (username === env.TK_ADMIN && password === env.MK_ADMIN) {
                    return jsonResponse({ success: true, secret: env.ADMIN_SECRET });
                } else {
                    return errorResponse("Invalid Credentials", 401);
                }
            } catch (e) {
                return errorResponse("Invalid Request Body", 400);
            }
        }

        return errorResponse("Not Found", 404);
    },
};
