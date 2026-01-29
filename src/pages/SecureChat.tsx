import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    ShieldCheck,
    Lock,
    Unlock,
    Copy,
    QrCode,
    Download,
    RefreshCcw,
    Send,
    Eye,
    EyeOff,
    Trash2,
    AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import {
    deriveKey,
    encryptMessage,
    decryptMessage,
    generateSalt,
    generateIv,
    b64ToUint8,
    uint8ToB64
} from "@/lib/crypto";
import { getParam } from "@/lib/url-state";
import { QRCodeSVG } from "qrcode.react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { clearAllData } from "@/lib/storage";

const SecureChat = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const qrRef = useRef<SVGSVGElement>(null);

    const [mode, setMode] = useState<'create' | 'locked' | 'unlocked'>('create');
    const [message, setMessage] = useState("");
    const [passphrase, setPassphrase] = useState("");
    const [showPassphrase, setShowPassphrase] = useState(false);

    // URL Params
    const [mParam, setMParam] = useState<string | null>(null);
    const [sParam, setSParam] = useState<string | null>(null);
    const [iParam, setIParam] = useState<string | null>(null);

    const [isDecrypting, setIsDecrypting] = useState(false);
    const [shareUrl, setShareUrl] = useState("");

    useEffect(() => {
        const m = getParam("m");
        const s = getParam("s");
        const i = getParam("i");

        if (m && s && i) {
            setMParam(m);
            setSParam(s);
            setIParam(i);
            setMode('locked');
        } else {
            setMode('create');
        }
    }, [location.search]);

    const handleDecrypt = async () => {
        if (!passphrase || !mParam || !sParam || !iParam) {
            toast.error("Please enter the secret code");
            return;
        }

        setIsDecrypting(true);
        try {
            const salt = b64ToUint8(sParam);
            const key = await deriveKey(passphrase, salt);
            const decrypted = await decryptMessage(mParam, iParam, key);

            setMessage(decrypted);
            setMode('unlocked');
            toast.success("Message decrypted successfully!");
        } catch (e) {
            toast.error("Incorrect code or corrupted data");
            console.error(e);
        } finally {
            setIsDecrypting(false);
        }
    };

    const handleGenerateLink = async () => {
        if (!message) {
            toast.error("Please enter a message");
            return;
        }
        if (!passphrase) {
            toast.error("Please set a secret code");
            return;
        }

        try {
            const salt = generateSalt();
            const iv = generateIv();
            const key = await deriveKey(passphrase, salt);
            const encrypted = await encryptMessage(message, key, iv);

            const params = new URLSearchParams();
            params.set("m", encrypted.ciphertext);
            params.set("s", uint8ToB64(salt));
            params.set("i", encrypted.iv);

            const url = `${window.location.origin}${window.location.pathname}#/?${params.toString()}`;
            setShareUrl(url);
            toast.success("Secret link generated!");
        } catch (e) {
            toast.error("Failed to encrypt message");
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard!");
    };

    const downloadQRCode = () => {
        const svg = qrRef.current;
        if (!svg) return;

        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const img = new Image();

        img.onload = () => {
            canvas.width = img.width + 40;
            canvas.height = img.height + 40;
            if (ctx) {
                ctx.fillStyle = "white";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 20, 20);
                const pngFile = canvas.toDataURL("image/png");
                const downloadLink = document.createElement("a");
                downloadLink.download = `secret-qr-${Date.now()}.png`;
                downloadLink.href = pngFile;
                downloadLink.click();
            }
        };

        img.src = "data:image/svg+xml;base64," + btoa(svgData);
    };

    const resetExchange = () => {
        setMode('create');
        setMessage("");
        setPassphrase("");
        setShareUrl("");
        setMParam(null);
        setSParam(null);
        setIParam(null);
        navigate("/", { replace: true });
    };

    if (mode === 'locked') {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
                <Card className="max-w-md w-full border-primary/20 shadow-xl">
                    <CardHeader className="text-center space-y-2">
                        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                            <Lock className="h-8 w-8 text-primary" />
                        </div>
                        <CardTitle className="text-2xl font-bold">Encrypted Message</CardTitle>
                        <CardDescription>
                            Someone has shared a secret with you.
                            Enter the code to reveal it.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="code">Secret Code</Label>
                            <div className="relative">
                                <Input
                                    id="code"
                                    type={showPassphrase ? "text" : "password"}
                                    placeholder="Enter the shared code..."
                                    value={passphrase}
                                    onChange={(e) => setPassphrase(e.target.value)}
                                    className="pr-10"
                                    onKeyDown={(e) => e.key === 'Enter' && handleDecrypt()}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassphrase(!showPassphrase)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showPassphrase ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                        <Button
                            className="w-full h-12 text-lg"
                            onClick={handleDecrypt}
                            disabled={isDecrypting}
                        >
                            {isDecrypting ? "Decrypting..." : "Unlock Secret"}
                        </Button>
                        <Button variant="ghost" className="w-full" onClick={resetExchange}>
                            Go Back / Create New
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <header className="border-b px-4 py-4 bg-muted/10">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="h-6 w-6 text-primary" />
                        <h1 className="font-bold text-xl tracking-tight">
                            Secret Exchange
                        </h1>
                    </div>
                    {mode !== 'create' && (
                        <Button variant="outline" size="sm" onClick={resetExchange}>
                            Create New
                        </Button>
                    )}
                </div>
            </header>

            <main className="flex-1 max-w-3xl w-full mx-auto p-4 md:p-8 space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            {mode === 'create' ? <RefreshCcw className="h-5 w-5" /> : <Unlock className="h-5 w-5 text-green-500" />}
                            {mode === 'create' ? "Start New Secret" : "Secret Revealed"}
                        </CardTitle>
                        <CardDescription>
                            {mode === 'create'
                                ? "Write your message and set a code. Only someone with the code can read it."
                                : "You've successfully decrypted the message. You can now edit it or change the code to reply."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="message">Your Secret Message</Label>
                            <Textarea
                                id="message"
                                placeholder="Type your secret here..."
                                className="min-h-[150px] text-base"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="passphrase">Secret Code (Encryption Key)</Label>
                            <div className="relative">
                                <Input
                                    id="passphrase"
                                    type={showPassphrase ? "text" : "password"}
                                    placeholder="Enter a strong code..."
                                    value={passphrase}
                                    onChange={(e) => setPassphrase(e.target.value)}
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassphrase(!showPassphrase)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showPassphrase ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            <p className="text-[10px] text-muted-foreground py-1">
                                [WARNING] Codes are not stored. If you forget it, the message is locked forever.
                            </p>
                        </div>

                        <Button className="w-full h-12 gap-2" onClick={handleGenerateLink}>
                            <RefreshCcw className="h-4 w-4" />
                            {mode === 'create' ? "Generate Sharing Link" : "Update Secret Link"}
                        </Button>
                    </CardContent>
                </Card>

                {shareUrl && (
                    <Card className="border-primary bg-primary/5 animate-in slide-in-from-bottom-4 duration-500">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Send className="h-5 w-5" />
                                Share Your Secret
                            </CardTitle>
                            <CardDescription>
                                Copy the link or show the QR code.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex gap-2">
                                <Input readOnly value={shareUrl} className="bg-background" />
                                <Button variant="outline" size="icon" onClick={() => copyToClipboard(shareUrl)}>
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="flex flex-col items-center gap-6 py-4 bg-background rounded-xl border border-dashed">
                                <div className="p-4 bg-white rounded-lg">
                                    <QRCodeSVG
                                        value={shareUrl}
                                        size={200}
                                        level="H"
                                        ref={qrRef}
                                    />
                                </div>
                                <div className="flex gap-4">
                                    <Button variant="secondary" className="gap-2" onClick={() => copyToClipboard(shareUrl)}>
                                        <QrCode className="h-4 w-4" />
                                        Copy Link
                                    </Button>
                                    <Button variant="outline" className="gap-2" onClick={downloadQRCode}>
                                        <Download className="h-4 w-4" />
                                        Download QR
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Local Storage Management */}
                <Card className="border-destructive/30 bg-destructive/5 mt-12 opacity-80 hover:opacity-100 transition-opacity">
                    <CardHeader className="py-4">
                        <CardTitle className="text-sm font-bold text-destructive flex items-center gap-2 uppercase tracking-widest">
                            <Trash2 className="h-4 w-4" />
                            Danger Zone
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between gap-4 py-2">
                        <p className="text-xs text-muted-foreground max-w-[250px]">
                            Clear your browser's local cache for this application.
                        </p>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10">
                                    WIPE DATA
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="border-destructive/20">
                                <AlertDialogHeader>
                                    <div className="flex items-center gap-3 text-destructive mb-2">
                                        <AlertCircle className="h-6 w-6" />
                                        <AlertDialogTitle className="text-xl">System Wipe Warning</AlertDialogTitle>
                                    </div>
                                    <AlertDialogDescription className="text-base">
                                        This will <span className="font-bold text-foreground">permanently wipe</span> the local configuration and saved data from your browser. This tool is stateless, so your messages will still exist in previously sent URLs, but your local settings will be reset.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="mt-6 gap-2">
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        onClick={() => {
                                            clearAllData();
                                            resetExchange();
                                            toast.success("Local storage cleared.");
                                        }}
                                    >
                                        Wipe Everything
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </CardContent>
                </Card>
            </main>

            <footer className="py-8 text-center text-xs text-muted-foreground border-t bg-muted/5 mt-auto">
                <p>Private & Stateless. No data is stored on our servers.</p>
                <p className="mt-1">Built with military-grade 256-bit AES-GCM encryption.</p>
            </footer>
        </div>
    );
};

export default SecureChat;
