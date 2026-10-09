// components/DocumentationCard.jsx
import React from 'react';
import { FileText, Download, ExternalLink } from 'lucide-react';

export default function DocumentationCard() {
  const pdfUrl = '/documents/RF_Monitor_Workflow_Report_Final.pdf';
  const downloadFileName = 'RF_Signal_Monitoring_System_Workflow_Report.pdf';

  return (
    <div
      className="card doc-card"
      style={{
        marginTop: 20,
        marginBottom: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        padding: '16px 20px',
      }}
    >
      {/* Title & Description */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          <FileText size={20} color="#ff7a00" />
        </div>
        <div>
          <h2
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Project Report
          </h2>
          <p
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              margin: '2px 0 0',
            }}
          >
            Technical workflow, system architecture, and implementation report.
          </p>
        </div>
      </div>

      {/* Simple Download & Preview Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <a
          href={pdfUrl}
          download={downloadFileName}
          id="btn-download-workflow-report"
          className="btn btn-primary"
          style={{ textDecoration: 'none' }}
          aria-label="Download Project Report PDF"
        >
          <Download size={14} aria-hidden="true" />
          <span>Download PDF</span>
        </a>

        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          id="btn-view-workflow-report"
          className="btn btn-secondary"
          style={{ textDecoration: 'none' }}
          aria-label="Preview Project Report in new tab"
        >
          <ExternalLink size={14} aria-hidden="true" />
          <span>Preview</span>
        </a>
      </div>
    </div>
  );
}
