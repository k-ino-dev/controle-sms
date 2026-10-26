import {
  LayoutDashboard,
  UserCheck,
  GraduationCap,
  School,
  CreditCard,
  MessageSquareText,
  Settings,
  LucideIcon,
} from "lucide-react";

export interface NavigationItem {
  id: string;
  name: string;
  shortName: string;
  href: string;
  icon: LucideIcon;
  description: string;
  highlight?: boolean; // Bouton central d'action (Contrôle d'absence)
  inBottomBar?: boolean; // Directement dans la barre basse mobile (max 4 + bouton Plus)
}

// SOURCE UNIQUE DE VÉRITÉ pour toutes les pages de l'application
export const ALL_NAV_ITEMS: NavigationItem[] = [
  {
    id: "dashboard",
    name: "Tableau de bord",
    shortName: "Accueil",
    href: "/",
    icon: LayoutDashboard,
    description: "Statistiques, indicateurs et activités récentes",
    inBottomBar: true,
  },
  {
    id: "eleves",
    name: "Élèves",
    shortName: "Élèves",
    href: "/eleves",
    icon: GraduationCap,
    description: "Gestion des inscriptions, coordonnées et archives",
    inBottomBar: true,
  },
  {
    id: "presence",
    name: "Contrôle d'absence",
    shortName: "Contrôle",
    href: "/presence",
    icon: UserCheck,
    description: "Appel tactile en direct & SMS automatiques",
    highlight: true,
    inBottomBar: true,
  },
  {
    id: "paiements",
    name: "Frais & Scolarité",
    shortName: "Paiements",
    href: "/paiements",
    icon: CreditCard,
    description: "Suivi des 9 mois, reçus A4 et relances SMS",
    inBottomBar: true,
  },
  {
    id: "classes",
    name: "Gestion des Classes",
    shortName: "Classes",
    href: "/classes",
    icon: School,
    description: "Création de classes, sections et affectations",
    inBottomBar: false,
  },
  {
    id: "sms",
    name: "Historique SMS",
    shortName: "SMS",
    href: "/sms",
    icon: MessageSquareText,
    description: "Journal de la file d'attente et passerelle WinSMS",
    inBottomBar: false,
  },
  {
    id: "parametres",
    name: "Paramètres de l'école",
    shortName: "Paramètres",
    href: "/parametres",
    icon: Settings,
    description: "Tarifs par niveau, modèles SMS et informations",
    inBottomBar: false,
  },
];
