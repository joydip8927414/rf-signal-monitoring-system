// components/DocumentationCard.jsx
import React from 'react';
import { FileText, Download, CheckCircle, ExternalLink } from 'lucide-react';

export default function DocumentationCard() {
  const pdfUrl = '/documents/RF_Monitor_Workflow_Report_Final.pdf';
  const downloadFileName = 'RF_Signal_Monitoring_System_Workflow_Report.pdf';

  return (
    <div
      className="card doc-card"
      style={{
        marginTop: 20,
        marginBottom: 8,
        border: '1px solid #E2E8F0',
        borderRadius: 12,
        background: '#FFFFFF',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
      aria-labelledby="doc-section-heading"
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        {/* Left: Icon & Title/Description */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, maxWidth: '620px' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(255, 122, 0, 0.12) 0%, rgba(107, 33, 168, 0.12) 100%)',
              border: '1px solid rgba(255, 122, 0, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              marginTop: 2,
            }}
            aria-hidden="true"
          >
            <FileText size={22} color="#ff7a00" />
          </div>
          <div>
            <h2
              id="doc-section-heading"
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: '#111827',
                margin: 0,
                letterSpacing: '-0.01em',
              }}
            >
              Project Documentation
            </h2>
            <p
              style={{
                fontSize: 13,
                color: '#4B5563',
                margin: '4px 0 0',
                lineHeight: 1.45,
              }}
            >
              Technical workflow, system architecture, technology stack, implementation progress, and planned validation.
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <a
            href={pdfUrl}
            download={downloadFileName}
            id="btn-download-workflow-report"
            className="btn-doc-download"
            aria-label="Download Technical Workflow Report (PDF)"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '10px 18px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: '#FFFFFF',
              background: 'linear-gradient(135deg, #ff7a00 0%, #6b21a8 100%)',
              border: 'none',
              boxShadow: '0 2px 6px rgba(107, 33, 168, 0.25)',
              cursor: 'pointer',
              textDecoration: 'none',
              transition: 'opacity 0.2s ease, transform 0.15s ease',
            }}
          >
            <Download size={16} color="#FFFFFF" aria-hidden="true" />
            <span>Download Technical Workflow Report (PDF)</span>
          </a>

          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            id="btn-view-workflow-report"
            className="btn-doc-preview"
            aria-label="Preview Technical Workflow Report in new browser tab"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '9px 14px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: '#111827',
              background: '#F3F4F6',
              border: '1px solid #D1D5DB',
              cursor: 'pointer',
              textDecoration: 'none',
              transition: 'background-color 0.15s ease',
            }}
          >
            <ExternalLink size={15} color="#4B5563" aria-hidden="true" />
            <span>Preview</span>
          </a>
        </div>
      </div>

      {/* Meta indicators */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
          fontSize: 12,
          color: '#6B7280',
          paddingTop: 8,
          borderTop: '1px solid #F1F5F9',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <CheckCircle size={14} color="#16A34A" aria-hidden="true" />
          <span>Status: <strong>Verified Technical Report (18 Pages)</strong></span>
        </span>
        <span aria-hidden="true">•</span>
        <span>Version: <strong>October 2026 (Week 2 of 12)</strong></span>
        <span aria-hidden="true">•</span>
        <span>Track: <strong>B.Tech ECE Major Project</strong></span>
        <span aria-hidden="true">•</span>
        <span>Target: <code>RF_Signal_Monitoring_System_Workflow_Report.pdf</code></span>
      </div>
    </div>
  );
}
