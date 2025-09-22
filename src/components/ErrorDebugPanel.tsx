/**
 * ErrorDebugPanel - Displays debug details for errors systematically
 * Always visible when error has devNote, even if debug mode is OFF
 * Opens by default if ?debug=1 in URL or localStorage.debugMode==="1"
 */

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useDebug } from "@/lib/debug-context";
import { useEffect, useState } from "react";

interface ErrorDebugPanelProps {
  error?: any;
  devNote?: any;
  className?: string;
}

export function ErrorDebugPanel({ error, devNote, className = "" }: ErrorDebugPanelProps) {
  const { debug } = useDebug();
  const [shouldOpenByDefault, setShouldOpenByDefault] = useState(false);
  
  // Check for ?debug=1 in URL or localStorage debugMode
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlDebug = urlParams.get('debug') === '1';
    const localStorageDebug = localStorage.getItem('debugMode') === '1';
    setShouldOpenByDefault(urlDebug || localStorageDebug || debug);
  }, [debug]);

  // Get the devNote from error or direct prop
  const noteToDisplay = error?.devNote || devNote;
  
  // Don't render if no debug info available
  if (!noteToDisplay) return null;

  return (
    <div className={`mt-3 ${className}`}>
      <Accordion 
        type="single" 
        collapsible 
        defaultValue={shouldOpenByDefault ? "debug-details" : undefined}
        className="w-full"
      >
        <AccordionItem value="debug-details" className="border-red-200 dark:border-red-800" data-testid="debug-details">
          <AccordionTrigger 
            className="text-sm font-medium text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100"
            data-testid="debug-details-trigger"
          >
            Debug details
          </AccordionTrigger>
          <AccordionContent data-testid="debug-details-content">
            <div className="p-3 bg-red-50/50 dark:bg-red-950/20 rounded-md">
              <pre className="text-xs overflow-auto max-h-80 text-red-900 dark:text-red-100 whitespace-pre-wrap break-all">
                {JSON.stringify(noteToDisplay, null, 2)}
              </pre>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}