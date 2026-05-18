import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
        return new NextResponse("Missing widget ID", { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;

    // The script that will be executed on the client's website
    const script = `
(function() {
    var widgetId = "${id}";
    var baseUrl = "${baseUrl}";
    
    // Create the bubble button
    var bubble = document.createElement('div');
    bubble.id = 'wa-widget-bubble';
    bubble.innerHTML = '<svg viewBox="0 0 24 24" width="32" height="32" fill="white"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.767 5.767 0 1.267.405 2.436 1.087 3.388l-.694 2.542 2.605-.684a5.72 5.72 0 0 0 2.769.711c3.181 0 5.767-2.586 5.767-5.767 0-3.181-2.586-5.767-5.767-5.767zm3.344 8.205c-.145.405-.715.742-1.18.794-.309.033-.715.056-1.155-.112-.24-.092-.544-.223-.925-.389-1.616-.703-2.659-2.355-2.739-2.46-.081-.106-.653-.87-.653-1.658 0-.788.411-1.177.556-1.341.145-.165.315-.205.421-.205l.3-.006c.11 0 .257-.005.371.27.145.352.502 1.221.544 1.314.041.092.069.199.006.315-.062.116-.093.187-.185.294-.092.106-.192.238-.274.32-.092.092-.191.194-.083.376.109.182.483.797 1.037 1.289.715.635 1.314.832 1.499.924.185.092.294.077.404-.047.106-.124.455-.53.578-.71.124-.18.248-.152.421-.087s1.103.52 1.294.615c.191.095.318.143.364.223.046.08.046.465-.098.87zM12 1.011c-6.073 0-11 4.927-11 11 0 2.067.57 4 1.554 5.656L1 23l5.525-1.453A10.94 10.94 0 0 0 12 23.011c6.073 0 11-4.927 11-11 0-6.073-4.927-11-11-11z"/></svg>';
    
    // Style the bubble
    var style = document.createElement('style');
    style.innerHTML = \`
        #wa-widget-bubble {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 60px;
            height: 60px;
            background-color: #25D366;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            cursor: pointer;
            z-index: 999999;
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        #wa-widget-bubble:hover {
            transform: scale(1.1);
        }
        #wa-widget-container {
            position: fixed;
            bottom: 90px;
            right: 20px;
            width: 350px;
            height: 500px;
            background: white;
            border-radius: 20px;
            box-shadow: 0 12px 24px rgba(0,0,0,0.15);
            z-index: 999998;
            overflow: hidden;
            display: none;
            flex-direction: column;
            transition: all 0.3s ease;
            border: 1px solid rgba(0,0,0,0.05);
        }
        #wa-widget-container.open {
            display: flex;
            animation: wa-slide-up 0.3s ease;
        }
        @keyframes wa-slide-up {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 480px) {
            #wa-widget-container {
                width: calc(100% - 40px);
                height: calc(100% - 120px);
            }
        }
    \`;
    document.head.appendChild(style);
    
    // Create the container/iframe
    var container = document.createElement('div');
    container.id = 'wa-widget-container';
    
    // Pass URL params of current page to the widget
    var currentParams = window.location.search;
    var iframeSrc = baseUrl + '/widget/' + widgetId + currentParams;
    
    container.innerHTML = '<iframe src="' + iframeSrc + '" style="width:100%; height:100%; border:none;"></iframe>';
    
    document.body.appendChild(bubble);
    document.body.appendChild(container);
    
    bubble.onclick = function() {
        container.classList.toggle('open');
    };
})();
    `;

    return new NextResponse(script, {
        headers: {
            "Content-Type": "application/javascript",
            "Cache-Control": "public, max-age=3600",
        },
    });
}
