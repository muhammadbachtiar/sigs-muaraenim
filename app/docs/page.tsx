'use client'

import { useEffect, useState } from 'react'
import Head from 'next/head'

export default function DocsPage() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 1. Load Swagger UI CSS
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css'
    document.head.appendChild(link)

    // 2. Load Swagger UI Bundle JS
    const scriptBundle = document.createElement('script')
    scriptBundle.src = 'https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js'
    scriptBundle.async = true
    document.head.appendChild(scriptBundle)

    // 3. Load Standalone Preset JS
    const scriptPreset = document.createElement('script')
    scriptPreset.src = 'https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-standalone-preset.js'
    scriptPreset.async = true
    document.head.appendChild(scriptPreset)

    scriptPreset.onload = () => {
      // Check if SwaggerUI is available
      const interval = setInterval(() => {
        if ((window as any).SwaggerUIBundle) {
          clearInterval(interval)
          ;(window as any).SwaggerUIBundle({
            url: '/openapi.json',
            dom_id: '#swagger-ui',
            presets: [
              (window as any).SwaggerUIBundle.presets.apis,
              (window as any).SwaggerUIStandalonePreset
            ],
            layout: 'BaseLayout',
            deepLinking: true,
            docExpansion: 'list',
          })
          setLoading(false)
        }
      }, 100)
    }

    return () => {
      document.head.removeChild(link)
      document.head.removeChild(scriptBundle)
      document.head.removeChild(scriptPreset)
    }
  }, [])

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f6f5f4', fontFamily: 'sans-serif' }}>
      {/* Custom Header styles to adjust Swagger UI to Notion styling */}
      <style dangerouslySetInnerHTML={{ __html: `
        .swagger-ui .topbar { display: none !important; }
        .swagger-ui .info { margin: 24px 0 !important; padding: 0 20px !important; }
        .swagger-ui .info .title { font-size: 2rem !important; font-weight: 700 !important; color: #000000 !important; letter-spacing: -0.625px !important; }
        .swagger-ui .info p { font-size: 0.9375rem !important; line-height: 1.5 !important; color: #615d59 !important; }
        .swagger-ui .scheme-container { background: #ffffff !important; border: 1px solid #e6e6e6 !important; box-shadow: 0 2px 8px rgba(0,0,0,0.02) !important; border-radius: 12px !important; margin: 20px !important; }
        .swagger-ui .opblock { border-radius: 8px !important; box-shadow: 0 1px 3px rgba(0,0,0,0.01) !important; border: 1px solid #e6e6e6 !important; }
        .swagger-ui .opblock.opblock-get { background: rgba(34, 197, 94, 0.05) !important; border-color: rgba(34, 197, 94, 0.2) !important; }
        .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #22c55e !important; border-radius: 4px !important; }
        .swagger-ui .opblock.opblock-post { background: rgba(0, 117, 222, 0.05) !important; border-color: rgba(0, 117, 222, 0.2) !important; }
        .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #0075de !important; border-radius: 4px !important; }
        .swagger-ui .opblock.opblock-put { background: rgba(234, 179, 8, 0.05) !important; border-color: rgba(234, 179, 8, 0.2) !important; }
        .swagger-ui .opblock.opblock-put .opblock-summary-method { background: #eab308 !important; border-radius: 4px !important; }
        .swagger-ui .opblock.opblock-delete { background: rgba(239, 68, 68, 0.05) !important; border-color: rgba(239, 68, 68, 0.2) !important; }
        .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: #ef4444 !important; border-radius: 4px !important; }
      `}} />

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', color: '#615d59' }}>
            <div style={{ width: '32px', height: '32px', border: '3px solid #e6e6e6', borderTopColor: '#0075de', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ marginTop: '16px', fontSize: '14px', fontWeight: 500 }}>Memuat Dokumentasi API...</p>
            <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { to { transform: rotate(360deg); } }` }} />
          </div>
        )}
        <div id="swagger-ui" style={{ display: loading ? 'none' : 'block' }} />
      </div>
    </div>
  )
}
