/**
 * Component to display residual check error details in a collapsible panel
 * Shows detailed debug information when residual check fails
 */

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useDebug } from "@/lib/debug-context";

interface ResidualDetailsProps {
  devNote: any;
  className?: string;
}

export function ResidualDetails({ devNote, className = "" }: ResidualDetailsProps) {
  const { debug } = useDebug();

  if (!devNote) return null;

  return (
    <div className={`mt-3 ${className}`}>
      <Accordion 
        type="single" 
        collapsible 
        defaultValue={debug ? "residual-details" : undefined}
        className="w-full"
      >
        <AccordionItem value="residual-details" className="border-orange-200 dark:border-orange-800">
          <AccordionTrigger className="text-sm font-medium text-orange-700 dark:text-orange-300 hover:text-orange-900 dark:hover:text-orange-100">
            Residual Details
          </AccordionTrigger>
          <AccordionContent>
            <div className="p-3 bg-orange-50/50 dark:bg-orange-950/20 rounded-md">
              <pre className="text-xs overflow-auto max-h-80 text-orange-900 dark:text-orange-100 whitespace-pre-wrap break-all">
                {JSON.stringify(devNote, null, 2)}
              </pre>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}