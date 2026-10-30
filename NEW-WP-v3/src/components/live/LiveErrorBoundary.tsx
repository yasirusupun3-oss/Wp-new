'use client';

import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { exitAppFullscreen } from '@/lib/utils';

interface Props {
  children: ReactNode;
  onClose: () => void;
  label?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Catches crashes inside real-time video views (Live streaming or 1:1 video
 * calls — both run the same WebRTC/Agora video engine, which can crash on a
 * low-memory device) so the whole page doesn't die with a browser-level
 * "This page couldn't load" error. Shows a recoverable screen instead, and
 * lets the person close back out to the rest of the app.
 */
export class LiveErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : 'Something went wrong.';
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error('[LiveErrorBoundary] caught crash:', error);
  }

  handleClose = () => {
    exitAppFullscreen();
    this.setState({ hasError: false, message: '' });
    this.props.onClose();
  };

  render() {
    if (this.state.hasError) {
      const label = this.props.label || 'live view';
      return (
        <div className="fixed inset-0 z-50 bg-[#0B141A] flex items-center justify-center px-6">
          <div className="flex flex-col items-center gap-4 text-center max-w-xs">
            <div className="w-16 h-16 rounded-full bg-red-600/20 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <span className="text-sm text-white font-medium">The {label} crashed</span>
            <span className="text-xs text-white/60 leading-relaxed">
              This can happen if the camera/video engine runs out of memory on your device.
              {this.state.message ? ` (${this.state.message})` : ''}
            </span>
            <button
              onClick={this.handleClose}
              className="mt-2 px-5 py-2 rounded-full bg-[#25D366] text-black text-sm font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
