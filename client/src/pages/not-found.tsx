import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { useTranslation } from "@/i18n";

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen w-full flex items-center justify-center px-5">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2 items-center">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold" data-testid="text-notfound-title">
              {t("notFound.title")}
            </h1>
          </div>
          <p className="mt-4 text-sm text-muted-foreground" data-testid="text-notfound-body">
            {t("notFound.body")}
          </p>
          <Link
            href="/"
            data-testid="link-notfound-home"
            className="inline-block mt-5 text-sm text-primary hover:opacity-80"
          >
            {t("notFound.backHome")}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
