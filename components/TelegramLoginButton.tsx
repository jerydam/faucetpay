// components/TelegramLoginButton.tsx
import { useEffect, useRef } from 'react';

export function TelegramLoginButton({ botName, onAuth }: { botName: string, onAuth: (user: any) => void }) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current || containerRef.current.innerHTML !== "") return;

        const script = document.createElement('script');
        script.src = "https://telegram.org/js/telegram-widget.js?22";
        script.setAttribute('data-telegram-login', botName);
        script.setAttribute('data-size', 'medium');
        script.setAttribute('data-radius', '5');
        script.setAttribute('data-request-access', 'write');
        script.setAttribute('data-onauth', 'onTelegramAuth(user)');
        script.async = true;

        containerRef.current.appendChild(script);

        // Define global callback
        (window as any).onTelegramAuth = (user: any) => {
            onAuth(user);
        };
    }, [botName, onAuth]);

    return <div ref={containerRef} className="flex justify-end" />;
}