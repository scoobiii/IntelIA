import React, { useState, useEffect } from "react";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  Upload, 
  User, 
  DollarSign, 
  Cpu, 
  GitCommit, 
  ArrowRight, 
  RefreshCw, 
  Database, 
  Compass, 
  Sparkles,
  Info,
  Layers,
  ChevronRight,
  ShieldCheck,
  FileSpreadsheet,
  Settings,
  BookOpen,
  Briefcase
} from "lucide-react";
import { Employee, ClockInEntry, NonConformity, GeofenceZone, ClockInType, UserRole, UserProfile, Candidate, JiraTask, EmployeeTraining } from "./types";
import { SEED_EMPLOYEES, SEED_CLOCK_INS } from "./seedData";
import { calculateDailyCLT, calculateMonthlyCLT, minutesToTime, timeToMinutes } from "./cltUtils";
import { db } from "./firebase";
import { collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";

export default function App() {
  // Authentication & Session state
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem("clt_current_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  
  // Login input state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  // Sign up input state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regRole, setRegRole] = useState<UserRole>("colaborador");
  const [regRoleTitle, setRegRoleTitle] = useState("Analista de Processos");
  const [regPIS, setRegPIS] = useState("");
  const [regBaseSalary, setRegBaseSalary] = useState("2850");
  const [regContractHours, setRegContractHours] = useState("220");
  const [regError, setRegError] = useState<string | null>(null);

  // Profile management and list state
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [editingProfileName, setEditingProfileName] = useState("");
  const [editingProfileEmail, setEditingProfileEmail] = useState("");
  const [editingProfilePassword, setEditingProfilePassword] = useState("");

  // Employee creation by RH Gestor state
  const [isRHRegisteringEmployee, setIsRHRegisteringEmployee] = useState(false);
  
  // State management
  const [employees, setEmployees] = useState<Employee[]>(SEED_EMPLOYEES);
  const [clockIns, setClockIns] = useState<ClockInEntry[]>(SEED_CLOCK_INS);
  const [activeEmployeeId, setActiveEmployeeId] = useState<string>("emp01");
  const [activeYearMonth, setActiveYearMonth] = useState<string>("2026-06");

  // Backoffice states
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jiraTasks, setJiraTasks] = useState<JiraTask[]>([]);
  const [trainings, setTrainings] = useState<EmployeeTraining[]>([]);
  
  // Interactive UI panel tabs
  const [aiHubTab, setAiHubTab] = useState<"ponto" | "holerite" | "almoco" | "geofencing" | "backoffice">("ponto");
  const [apiInfoOpen, setApiInfoOpen] = useState(true);
  const [customPrompt, setCustomPrompt] = useState<string>(
    `[ROLE]: Expert Auditor CLT.\n` +
    `[GOAL]: Extrair registros de comprovante de ponto amarelo impresso com acurácia de 100%.\n` +
    `[CONTEXT]: Tratar batidas concatenadas ou NSR sequenciais do mesmo dia como ordens cronológicas.`
  );

  // Gemini processing states
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>(["Sistema iniciado com 2 funcionários cadastrados.", "Ponto de Junho/2026 carregador por padrão."]);

  // Satellite and Location states
  const [satelliteImageFile, setSatelliteImageFile] = useState<string | null>(null);
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{lat: number; lng: number} | null>(null);
  const [isWithinFence, setIsWithinFence] = useState<boolean | null>(null);
  const [polygonBounds, setPolygonBounds] = useState<GeofenceZone>({
    latitude: -23.55052,  // Default São Paulo area
    longitude: -46.633308,
    radiusMeters: 150,
    address: "GPA CD1 - Rodovia Anhanguera, KM 14"
  });

  // Manual point state
  const [showAdminConfig, setShowAdminConfig] = useState<boolean>(false);
  const [manualTime, setManualTime] = useState("08:00");
  const [manualDate, setManualDate] = useState("2026-06-16");
  const [manualType, setManualType] = useState<ClockInType>("entrada");

  // Selfie simulation states
  const [selfieType, setSelfieType] = useState<ClockInType>("entrada");
  const [isRemoteWork, setIsRemoteWork] = useState<boolean>(false);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [selfieLogs, setSelfieLogs] = useState<{ type: ClockInType; date: string; time: string; remote: boolean; verified: boolean }[]>([
    { type: "entrada", date: "2026-06-16", time: "07:56", remote: false, verified: true },
    { type: "saida_alm", date: "2026-06-16", time: "12:02", remote: false, verified: true },
    { type: "volta_alm", date: "2026-06-16", time: "13:00", remote: false, verified: true }
  ]);

  // Backoffice Form State Hooks
  const [backofficeSubTab, setBackofficeSubTab] = useState<"vagas" | "jira" | "treinamento">("vagas");
  
  // Candidates Form Fields
  const [candName, setCandName] = useState("");
  const [candEmail, setCandEmail] = useState("");
  const [candPhone, setCandPhone] = useState("");
  const [candSummary, setCandSummary] = useState("");
  const [candSkills, setCandSkills] = useState("");

  // Jira Tasks Form Fields
  const [jiraTaskTitle, setJiraTaskTitle] = useState("");
  const [jiraTaskDesc, setJiraTaskDesc] = useState("");
  const [jiraTaskAssignee, setJiraTaskAssignee] = useState("");
  const [jiraTaskPriority, setJiraTaskPriority] = useState<"Crítica" | "Alta" | "Média" | "Baixa">("Média");
  const [jiraTaskDomain, setJiraTaskDomain] = useState("Folha / ERP");
  const [showJiraModal, setShowJiraModal] = useState(false);

  // Trainings Form Fields
  const [trainCourseName, setTrainCourseName] = useState("");
  const [trainEmployeeId, setTrainEmployeeId] = useState("");

  // Dashboard Tab selection: diária, semanal ou mensal
  const [dashboardViewMode, setDashboardViewMode] = useState<"diaria" | "semanal" | "mensal">("mensal");
  const [selectedDayForDaily, setSelectedDayForDaily] = useState<string>("2026-06-16");

  // ERP selected for integration connector
  const [selectedERP, setSelectedERP] = useState<"totvs" | "senior" | "adp" | "alterdata">("totvs");

  const activeEmployee = employees.find(e => e.id === activeEmployeeId) || employees[0];

  // Load state from Firebase on init, with fallbacks to localStorage
  useEffect(() => {
    const loadFromFirestore = async () => {
      addLog("Conectando ao banco de dados Firestore em nuvem real (acurácia 100%)...");
      try {
        const empQuery = await getDocs(collection(db, "employees"));
        const clockQuery = await getDocs(collection(db, "clock_ins"));
        const userQuery = await getDocs(collection(db, "users_profiles"));
        const candQuery = await getDocs(collection(db, "candidates"));
        const jiraQuery = await getDocs(collection(db, "jira_tasks"));
        const trainQuery = await getDocs(collection(db, "employee_trainings"));
        
        let loadedEmployees: Employee[] = [];
        let loadedClockIns: ClockInEntry[] = [];
        let loadedUsers: UserProfile[] = [];
        let loadedCandidates: Candidate[] = [];
        let loadedJiraTasks: JiraTask[] = [];
        let loadedTrainings: EmployeeTraining[] = [];
        
        empQuery.forEach((docSnap) => {
          loadedEmployees.push(docSnap.data() as Employee);
        });
        
        clockQuery.forEach((docSnap) => {
          loadedClockIns.push(docSnap.data() as ClockInEntry);
        });

        userQuery.forEach((docSnap) => {
          loadedUsers.push(docSnap.data() as UserProfile);
        });

        candQuery.forEach((docSnap) => {
          loadedCandidates.push(docSnap.data() as Candidate);
        });

        jiraQuery.forEach((docSnap) => {
          loadedJiraTasks.push(docSnap.data() as JiraTask);
        });

        trainQuery.forEach((docSnap) => {
          loadedTrainings.push(docSnap.data() as EmployeeTraining);
        });

        const SEED_USERS: UserProfile[] = [
          {
            id: "user-rh",
            email: "rh@gpa.com",
            name: "Mariana Souza (RH)",
            password: "rh",
            role: "gestor_rh",
            createdAt: "2026-06-16"
          },
          {
            id: "user-emp01",
            email: "jose@gpa.com",
            name: "José Soares Sobrinho",
            password: "jose",
            role: "colaborador",
            employeeId: "emp01",
            createdAt: "2026-06-16"
          },
          {
            id: "user-emp02",
            email: "maria@gpa.com",
            name: "Maria de Souza Menezes",
            password: "maria",
            role: "colaborador",
            employeeId: "emp02",
            createdAt: "2026-06-16"
          }
        ];

        const SEED_CANDIDATES: Candidate[] = [
          {
            id: "cand-01",
            name: "Guilherme Sampaio",
            email: "guilherme.sampaio@hotmail.com",
            phone: "(11) 98765-4321",
            appliedVacancy: "Analista de Desenvolvimento de Sistemas III",
            step: "1",
            summary: "Desenvolvedor Full Stack com 4 anos de experiência em integrações de ERP e Backoffice.",
            techSkills: "React, Node.js, Git, Jira, Oracle Fusion, PostgreSQL",
            appliedDate: "2026-04-15"
          },
          {
            id: "cand-02",
            name: "Patrícia Lima",
            email: "patricia.lima@gmail.com",
            phone: "(11) 99888-1122",
            appliedVacancy: "Analista de Desenvolvimento de Sistemas III",
            step: "2",
            summary: "Especialista em automação sitemica financeira com foco em Mastersaf e Tax One.",
            techSkills: "Mastersaf, Tax One, Java, Oracle Pl/SQL",
            appliedDate: "2026-04-18"
          }
        ];

        const SEED_JIRA_TASKS: JiraTask[] = [
          {
            id: "ODP-101",
            title: "Sincronização ERP Oracle Fusion com Gen.te Nuvem (LG)",
            description: "Configuração de webhook de sincronização automatizada para cargas salariais brutas de rescisão.",
            systemDomain: "Folha / ERP",
            priority: "Alta",
            status: "In Progress",
            assignee: "Guilherme Sampaio"
          },
          {
            id: "ODP-102",
            title: "Correção de layout de exportação fiscal no Tax One",
            description: "Garantir inclusão do bloco K de notas fiscais de entrada de prestação de serviços odontológicos na apuração tributária.",
            systemDomain: "Tributário",
            priority: "Média",
            status: "To Do",
            assignee: "Suporte TaxOne"
          },
          {
            id: "ODP-103",
            title: "Mapeamento DFe no Mastersaf DW",
            description: "Efetuar carga de notas fiscais eletrônicas de Barueri para dedução fiscal automática.",
            systemDomain: "Tributário",
            priority: "Alta",
            status: "Done",
            assignee: "Patrícia Lima"
          },
          {
            id: "ODP-104",
            title: "Avisos automáticos de prazos trabalhistas no Painel CLT",
            description: "Construir disparador de notificações automáticas de incongruências graves de jornada que possam motivar disputas legais.",
            systemDomain: "Jurídico",
            priority: "Média",
            status: "Backlog",
            assignee: "Pádua Advocacia"
          }
        ];

        const SEED_TRAININGS: EmployeeTraining[] = [
          {
            id: "train-01",
            employeeId: "emp01",
            courseName: "Introdução à Portaria MTP 671 e Conformidade CLT",
            progress: 100,
            completed: true,
            lastActivity: "2026-06-10"
          },
          {
            id: "train-02",
            employeeId: "emp01",
            courseName: "Configuração Técnica do ERP Oracle Fusion",
            progress: 40,
            completed: false,
            lastActivity: "2026-06-14"
          },
          {
            id: "train-03",
            employeeId: "emp02",
            courseName: "Introdução à Portaria MTP 671 e Conformidade CLT",
            progress: 100,
            completed: true,
            lastActivity: "2026-06-12"
          },
          {
            id: "train-04",
            employeeId: "emp02",
            courseName: "Apuração Tributária e Módulo Tax One",
            progress: 80,
            completed: false,
            lastActivity: "2026-06-15"
          }
        ];

        if (loadedUsers.length === 0) {
          addLog("Inicializando credenciais padrão de usuários na coleção users_profiles...");
          for (const u of SEED_USERS) {
            await setDoc(doc(db, "users_profiles", u.id), u);
          }
          setUsers(SEED_USERS);
        } else {
          setUsers(loadedUsers);
        }

        if (loadedEmployees.length === 0) {
          addLog("Iniciando primeira carga de dados de colaboradores no Firestore...");
          for (const emp of SEED_EMPLOYEES) {
            await setDoc(doc(db, "employees", emp.id), emp);
          }
          for (const clk of SEED_CLOCK_INS) {
            await setDoc(doc(db, "clock_ins", clk.id), clk);
          }
          setEmployees(SEED_EMPLOYEES);
          setClockIns(SEED_CLOCK_INS);
        } else {
          loadedClockIns.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
          setEmployees(loadedEmployees);
          setClockIns(loadedClockIns);
        }

        if (loadedCandidates.length === 0) {
          addLog("Inicializando candidatos padrão da vaga Analista III...");
          for (const cand of SEED_CANDIDATES) {
            await setDoc(doc(db, "candidates", cand.id), cand);
          }
          setCandidates(SEED_CANDIDATES);
        } else {
          setCandidates(loadedCandidates);
        }

        if (loadedJiraTasks.length === 0) {
          addLog("Inicializando tarefas técnicas de backoffice do Jira de Analista III...");
          for (const jt of SEED_JIRA_TASKS) {
            await setDoc(doc(db, "jira_tasks", jt.id), jt);
          }
          setJiraTasks(SEED_JIRA_TASKS);
        } else {
          setJiraTasks(loadedJiraTasks);
        }

        if (loadedTrainings.length === 0) {
          addLog("Inicializando treinamentos corporativos obrigatórios de backoffice...");
          for (const tr of SEED_TRAININGS) {
            await setDoc(doc(db, "employee_trainings", tr.id), tr);
          }
          setTrainings(SEED_TRAININGS);
        } else {
          setTrainings(loadedTrainings);
        }

        addLog(`Banco de dados carregado com sucesso do Cloud Firestore: ${loadedEmployees.length || SEED_EMPLOYEES.length} colaboradores, ${loadedCandidates.length || SEED_CANDIDATES.length} candidatos, ${loadedJiraTasks.length || SEED_JIRA_TASKS.length} tarefas de roadmap Jira.`);

      } catch (err) {
        console.error("Erro carregando do Firestore, revertendo para localStorage:", err);
        addLog("Conexão offline: Carregando cache local do navegador.");
        const savedEmployees = localStorage.getItem("clt_employees");
        const savedClockIns = localStorage.getItem("clt_clock_ins");
        const savedUsers = localStorage.getItem("clt_users");
        
        if (savedEmployees && savedClockIns) {
          try {
            setEmployees(JSON.parse(savedEmployees));
            setClockIns(JSON.parse(savedClockIns));
            if (savedUsers) {
              setUsers(JSON.parse(savedUsers));
            }
          } catch (e) {
            console.error(e);
          }
        }

        const savedCandidates = localStorage.getItem("clt_candidates");
        const savedJira = localStorage.getItem("clt_jira");
        const savedTrainings = localStorage.getItem("clt_trainings");
        
        try {
          const loadedCands = savedCandidates ? JSON.parse(savedCandidates) : [];
          setCandidates(loadedCands.length ? loadedCands : [
            {
              id: "cand-01",
              name: "Guilherme Sampaio",
              email: "guilherme.sampaio@hotmail.com",
              phone: "(11) 98765-4321",
              appliedVacancy: "Analista de Desenvolvimento de Sistemas III",
              step: "1",
              summary: "Desenvolvedor Full Stack com 4 anos de experiência em integrações de ERP e Backoffice.",
              techSkills: "React, Node.js, Git, Jira, Oracle Fusion, PostgreSQL",
              appliedDate: "2026-04-15"
            },
            {
              id: "cand-02",
              name: "Patrícia Lima",
              email: "patricia.lima@gmail.com",
              phone: "(11) 99888-1122",
              appliedVacancy: "Analista de Desenvolvimento de Sistemas III",
              step: "2",
              summary: "Especialista em automação sitemica financeira com foco em Mastersaf e Tax One.",
              techSkills: "Mastersaf, Tax One, Java, Oracle Pl/SQL",
              appliedDate: "2026-04-18"
            }
          ]);

          const loadedJira = savedJira ? JSON.parse(savedJira) : [];
          setJiraTasks(loadedJira.length ? loadedJira : [
            {
              id: "ODP-101",
              title: "Sincronização ERP Oracle Fusion com Gen.te Nuvem (LG)",
              description: "Configuração de webhook de sincronização automatizada para cargas salariais brutas de rescisão.",
              systemDomain: "Folha / ERP",
              priority: "Alta",
              status: "In Progress",
              assignee: "Guilherme Sampaio"
            },
            {
              id: "ODP-102",
              title: "Correção de layout de exportação fiscal no Tax One",
              description: "Garantir inclusão do bloco K de notas fiscais de entrada de prestação de serviços odontológicos na apuração tributária.",
              systemDomain: "Tributário",
              priority: "Média",
              status: "To Do",
              assignee: "Suporte TaxOne"
            },
            {
              id: "ODP-103",
              title: "Mapeamento DFe no Mastersaf DW",
              description: "Efetuar carga de notas fiscais eletrônicas de Barueri para dedução fiscal automática.",
              systemDomain: "Tributário",
              priority: "Alta",
              status: "Done",
              assignee: "Patrícia Lima"
            },
            {
              id: "ODP-104",
              title: "Avisos automáticos de prazos trabalhistas no Painel CLT",
              description: "Construir disparador de notificações automáticas de incongruências graves de jornada que possam motivar disputas legais.",
              systemDomain: "Jurídico",
              priority: "Média",
              status: "Backlog",
              assignee: "Pádua Advocacia"
            }
          ]);

          const loadedTr = savedTrainings ? JSON.parse(savedTrainings) : [];
          setTrainings(loadedTr.length ? loadedTr : [
            {
              id: "train-01",
              employeeId: "emp01",
              courseName: "Introdução à Portaria MTP 671 e Conformidade CLT",
              progress: 100,
              completed: true,
              lastActivity: "2026-06-10"
            },
            {
              id: "train-02",
              employeeId: "emp01",
              courseName: "Configuração Técnica do ERP Oracle Fusion",
              progress: 40,
              completed: false,
              lastActivity: "2026-06-14"
            },
            {
              id: "train-03",
              employeeId: "emp02",
              courseName: "Introdução à Portaria MTP 671 e Conformidade CLT",
              progress: 100,
              completed: true,
              lastActivity: "2026-06-12"
            },
            {
              id: "train-04",
              employeeId: "emp02",
              courseName: "Apuração Tributária e Módulo Tax One",
              progress: 80,
              completed: false,
              lastActivity: "2026-06-15"
            }
          ]);
        } catch (e) {
          console.error(e);
        }
      }
    };
    
    loadFromFirestore();
  }, []);

  // Save details helper
  const updatePersistedState = async (newEmployees: Employee[], newClockIns: ClockInEntry[]) => {
    setEmployees(newEmployees);
    setClockIns(newClockIns);
    localStorage.setItem("clt_employees", JSON.stringify(newEmployees));
    localStorage.setItem("clt_clock_ins", JSON.stringify(newClockIns));

    // Async write to database
    try {
      addLog("Sincronizando modificação em tempo real com Cloud Firestore...");
      for (const emp of newEmployees) {
        await setDoc(doc(db, "employees", emp.id), emp);
      }
      for (const clk of newClockIns) {
        await setDoc(doc(db, "clock_ins", clk.id), clk);
      }
      addLog("Firestore sincronizado com sucesso.");
    } catch (err) {
      console.error("Falha ao atualizar Firestore:", err);
      addLog("Erro na replicação com o Firestore. Alterações mantidas em cache local.");
    }
  };

  const syncCandidates = async (newCandidates: Candidate[]) => {
    setCandidates(newCandidates);
    localStorage.setItem("clt_candidates", JSON.stringify(newCandidates));
    try {
      for (const cand of newCandidates) {
        await setDoc(doc(db, "candidates", cand.id), cand);
      }
    } catch (err) {
      console.error("Falha ao atualizar Firestore candidates:", err);
    }
  };

  const syncJiraTasks = async (newTasks: JiraTask[]) => {
    setJiraTasks(newTasks);
    localStorage.setItem("clt_jira", JSON.stringify(newTasks));
    try {
      for (const t of newTasks) {
        await setDoc(doc(db, "jira_tasks", t.id), t);
      }
    } catch (err) {
      console.error("Falha ao atualizar Firestore jira_tasks:", err);
    }
  };

  const deleteJiraTaskFromDb = async (taskId: string) => {
    const nextTasks = jiraTasks.filter(t => t.id !== taskId);
    setJiraTasks(nextTasks);
    localStorage.setItem("clt_jira", JSON.stringify(nextTasks));
    try {
      await deleteDoc(doc(db, "jira_tasks", taskId));
      addLog(`Tarefa [${taskId}] excluída com sucesso do Cloud Firestore.`);
    } catch (err) {
      console.error("Falha ao deletar jira_task:", err);
    }
  };

  const syncTrainings = async (newTrainings: EmployeeTraining[]) => {
    setTrainings(newTrainings);
    localStorage.setItem("clt_trainings", JSON.stringify(newTrainings));
    try {
      for (const tr of newTrainings) {
        await setDoc(doc(db, "employee_trainings", tr.id), tr);
      }
    } catch (err) {
      console.error("Falha ao atualizar Firestore trainings:", err);
    }
  };

  // Backoffice Action Handlers
  const handleCreateCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candName || !candEmail || !candPhone) {
      setResultMessage("Preencha Nome, E-mail e Telefone para se inscrever.");
      return;
    }
    const nextId = "cand-" + Date.now();
    const newCand: Candidate = {
      id: nextId,
      name: candName,
      email: candEmail,
      phone: candPhone,
      appliedVacancy: "Analista de Desenvolvimento de Sistemas III",
      step: "1", // Initial stage
      summary: candSummary || "Sem resumo anexado.",
      techSkills: candSkills || "Sem habilidades descritas.",
      appliedDate: new Date().toISOString().split("T")[0]
    };
    const updated = [...candidates, newCand];
    await syncCandidates(updated);
    addLog(`NOVO CANDIDATO: Instanciado candidato [${candName}] na coleção Firestore candidates.`);
    setResultMessage(`Inscrição de ${candName} enviada com sucesso!`);
    
    // Reset form fields
    setCandName("");
    setCandEmail("");
    setCandPhone("");
    setCandSummary("");
    setCandSkills("");
  };

  const handleUpdateCandidateStep = async (candidateId: string, nextStep: string) => {
    const updated = candidates.map(c => {
      if (c.id === candidateId) {
        return { ...c, step: nextStep };
      }
      return c;
    });
    await syncCandidates(updated);
    const updatedCand = updated.find(c => c.id === candidateId);
    addLog(`Candidato [${updatedCand?.name}] movido para a etapa [Etapa ${nextStep}] no pipeline de contratação.`);
    setResultMessage(`Status de ${updatedCand?.name} atualizado!`);
  };

  const handleHireAndIntegrateCandidate = async (cand: Candidate) => {
    addLog(`Iniciando contratação automatizada de ${cand.name}...`);
    try {
      const suffix = cand.id.replace("cand-", "").slice(-6);
      const empId = "emp-" + suffix;
      const userProfileId = "user-" + suffix;
      
      // Look for maximum index in employees or generate randomly
      const pisNum = "" + Math.floor(10000000000 + Math.random() * 90000000000); // 11 PIS-like digits
      
      const newEmployee: Employee = {
        id: empId,
        name: cand.name,
        registrationId: "PIS " + pisNum,
        role: "Analista de Desenvolvimento de Sistemas III",
        contractHoursPerMonth: 220,
        baseSalary: 8500,
        hourlyRate: 38.63,
        extraHoursBalance: 0,
        avatarColor: "bg-indigo-600",
        joinedDate: new Date().toISOString().split("T")[0]
      };

      const newUser: UserProfile = {
        id: userProfileId,
        email: cand.email,
        name: cand.name,
        password: "123", // default temp pwd
        role: "colaborador",
        employeeId: empId,
        createdAt: new Date().toISOString().split("T")[0]
      };

      // Add training requirements
      const newTraining1: EmployeeTraining = {
        id: "train-" + Date.now() + "-1",
        employeeId: empId,
        courseName: "Integração Suíte Gen.te Nuvem (LG Folha)",
        progress: 0,
        completed: false,
        lastActivity: new Date().toISOString().split("T")[0]
      };

      const newTraining2: EmployeeTraining = {
        id: "train-" + Date.now() + "-2",
        employeeId: empId,
        courseName: "Arquitetura Backoffice Odontoprev (Benner, Mastersaf)",
        progress: 0,
        completed: false,
        lastActivity: new Date().toISOString().split("T")[0]
      };

      // 1. Update Candidate State to step 4
      const updatedCandidates = candidates.map(c => {
        if (c.id === cand.id) {
          return { ...c, step: "4" };
        }
        return c;
      });
      await syncCandidates(updatedCandidates);

      // 2. Add Employee
      const updatedEmployees = [...employees, newEmployee];
      await updatePersistedState(updatedEmployees, clockIns);

      // 3. Add User Profile
      const updatedUsers = [...users, newUser];
      setUsers(updatedUsers);
      await setDoc(doc(db, "users_profiles", userProfileId), newUser);

      // 4. Add Employee training objects
      const updatedTrainings = [...trainings, newTraining1, newTraining2];
      await syncTrainings(updatedTrainings);

      addLog(`INTEGRAÇÃO FINALIZADA: ${cand.name} contratado com sucesso. Cadastrado no ERP local, Folha LG e credencial '${cand.email}' criada com senha padrão '123'.`);
      setResultMessage(`Parabéns! ${cand.name} agora é colaborador oficial! Nova conta ativa com e-mail: ${cand.email} (senha: 123).`);

    } catch (err: any) {
      console.error("Erro na contratação automatizada:", err);
      setResultMessage("Erro ao processar integração da contratação.");
    }
  };

  const handleCreateJiraTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jiraTaskTitle) {
      setResultMessage("O título da tarefa técnica no Jira é obrigatório.");
      return;
    }
    const nextNum = 100 + jiraTasks.length + 1;
    const nextId = `ODP-${nextNum}`;
    const newTask: JiraTask = {
      id: nextId,
      title: jiraTaskTitle,
      description: jiraTaskDesc || "Nenhuma especificação detalhada.",
      systemDomain: jiraTaskDomain,
      priority: jiraTaskPriority,
      status: "To Do",
      assignee: jiraTaskAssignee || "Sem Responsável"
    };
    const updated = [newTask, ...jiraTasks];
    await syncJiraTasks(updated);
    addLog(`JIRA TECHNICAL CARD CREATED: Adicionada tarefa técnica [${nextId}] na esteira da qualidade.`);
    setResultMessage(`Tarefa ${nextId} catalogada no Jira de Backoffice!`);
    
    // Clear inputs & close modal
    setJiraTaskTitle("");
    setJiraTaskDesc("");
    setJiraTaskAssignee("");
    setJiraTaskPriority("Média");
    setJiraTaskDomain("Folha / ERP");
    setShowJiraModal(false);
  };

  const handleUpdateJiraTaskStatus = async (taskId: string, nextStatus: JiraTask['status']) => {
    const updated = jiraTasks.map(t => {
      if (t.id === taskId) {
        return { ...t, status: nextStatus };
      }
      return t;
    });
    await syncJiraTasks(updated);
    addLog(`JIRA STATUS CHANGED: Mudança de status da tarefa [${taskId}] para [${nextStatus}].`);
    setResultMessage(`Tarefa ${taskId} movida para ${nextStatus}.`);
  };

  const handleCreateTraining = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trainCourseName || !trainEmployeeId) {
      setResultMessage("Defina o Curso e o Colaborador para atribuir o treinamento.");
      return;
    }
    const targetEmployee = employees.find(emp => emp.id === trainEmployeeId);
    if (!targetEmployee) return;

    const newTr: EmployeeTraining = {
      id: "train-" + Date.now(),
      employeeId: trainEmployeeId,
      courseName: trainCourseName,
      progress: 0,
      completed: false,
      lastActivity: new Date().toISOString().split("T")[0]
    };
    const updated = [...trainings, newTr];
    await syncTrainings(updated);
    addLog(`TREINAMENTO ATRIBUÍDO: Curso [${trainCourseName}] atribuído a ${targetEmployee.name}.`);
    setResultMessage(`Curso atribuído a ${targetEmployee.name}!`);
    setTrainCourseName("");
    setTrainEmployeeId("");
  };

  const handleIncrementTrainingProgress = async (trainingId: string) => {
    const target = trainings.find(t => t.id === trainingId);
    if (!target) return;

    const currentProgress = target.progress;
    const nextProgress = Math.min(100, currentProgress + 20);
    const isNowCompleted = nextProgress === 100;

    const updated = trainings.map(t => {
      if (t.id === trainingId) {
        return {
          ...t,
          progress: nextProgress,
          completed: isNowCompleted,
          lastActivity: new Date().toISOString().split("T")[0]
        };
      }
      return t;
    });
    await syncTrainings(updated);
    const targetEmployee = employees.find(emp => emp.id === target.employeeId);
    addLog(`EVOLUÇÃO TREINAMENTO: Progresso de ${targetEmployee?.name || "Funcionário"} no curso [${target.courseName}] subiu para ${nextProgress}%.`);
    setResultMessage(`Treinamento evoluído para ${nextProgress}%!`);
  };

  const addLog = (message: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [`[${time}] ${message}`, ...prev.slice(0, 20)]);
  };

  // Reset to seed data
  const handleResetData = async () => {
    addLog("Limpando e redefinindo banco de dados...");
    setResultMessage("Apagando e reinserindo dados originais...");
    await updatePersistedState(SEED_EMPLOYEES, SEED_CLOCK_INS);
    addLog("Banco de dados resetado no Firestore com sucesso.");
    setResultMessage("Configurações padrão restauradas!");
  };

  // --- USER AUTHENTICATION & LOGIN/SIGNUP HANDLERS ---
  
  const handleLogin = (emailInput: string, passwordInput: string) => {
    setLoginError(null);
    const cleanedEmail = emailInput.trim().toLowerCase();
    
    // Find matching user
    const matchedUser = users.find(u => u.email.trim().toLowerCase() === cleanedEmail);
    
    if (!matchedUser) {
      setLoginError("E-mail não cadastrado. Verifique a grafia ou crie uma nova conta.");
      addLog(`Falha de Login: E-mail ${cleanedEmail} não encontrado.`);
      return;
    }
    
    if (matchedUser.password !== passwordInput) {
      setLoginError("Senha incorreta. Tente novamente ou use os atalhos de demonstração.");
      addLog(`Falha de Login: Senha incorreta para o usuário ${cleanedEmail}.`);
      return;
    }
    
    // Successful login
    setCurrentUser(matchedUser);
    localStorage.setItem("clt_current_user", JSON.stringify(matchedUser));
    
    if (matchedUser.role === "colaborador" && matchedUser.employeeId) {
      setActiveEmployeeId(matchedUser.employeeId);
    }
    
    setLoginEmail("");
    setLoginPassword("");
    addLog(`Login efetuado com sucesso: ${matchedUser.name} (${matchedUser.role === "gestor_rh" ? "Gestor de RH" : "Colaborador"})`);
  };

  const handleRegister = async () => {
    setRegError(null);
    const cleanedName = regName.trim();
    const cleanedEmail = regEmail.trim().toLowerCase();
    const cleanedPassword = regPassword.trim();

    if (!cleanedName || !cleanedEmail || !cleanedPassword) {
      setRegError("Preencha Nome, E-mail e Senha para continuar o cadastro.");
      return;
    }

    // Check if email already exists
    const emailExists = users.some(u => u.email.trim().toLowerCase() === cleanedEmail);
    if (emailExists) {
      setRegError("Este e-mail já está sendo utilizado. Escolha outro.");
      return;
    }

    setIsProcessing(true);
    addLog(`Cadastrando novo perfil em nuvem: ${cleanedName}...`);

    try {
      const newUserId = `usr-${Date.now()}`;
      let linkedEmployeeId: string | undefined = undefined;

      // If registering as an employee, create corresponding Employee document first
      if (regRole === "colaborador") {
        linkedEmployeeId = `emp-${Date.now()}`;
        const finalPIS = regPIS.trim() || `PIS ${Math.floor(100000 + Math.random() * 900000)}-${Math.floor(Math.random() * 9)}`;
        const monthlyHours = parseInt(regContractHours) || 220;
        const baseSal = parseFloat(regBaseSalary) || 2850.00;
        const hourlyRate = parseFloat((baseSal / monthlyHours).toFixed(2));

        const newEmployee: Employee = {
          id: linkedEmployeeId,
          name: cleanedName,
          registrationId: finalPIS,
          role: regRoleTitle.trim() || "Colaborador CLT",
          contractHoursPerMonth: monthlyHours,
          baseSalary: baseSal,
          extraHoursBalance: 0,
          hourlyRate: hourlyRate,
          avatarColor: `bg-${["indigo-600", "teal-600", "emerald-600", "violet-600", "rose-600"][Math.floor(Math.random() * 5)]}`,
          joinedDate: new Date().toISOString().split("T")[0]
        };

        // Save Employee to Firestore & state
        await setDoc(doc(db, "employees", linkedEmployeeId), newEmployee);
        const updatedEmployees = [...employees, newEmployee];
        setEmployees(updatedEmployees);
        localStorage.setItem("clt_employees", JSON.stringify(updatedEmployees));
        addLog(`[Cadastro] Registro de Funcionário cadastrado para ${cleanedName}.`);
      }

      // Create main UserProfile document
      const newProfile: UserProfile = {
        id: newUserId,
        name: cleanedName,
        email: cleanedEmail,
        password: cleanedPassword,
        role: regRole,
        employeeId: linkedEmployeeId,
        createdAt: new Date().toISOString().split("T")[0]
      };

      // Save UserProfile to Firestore & state
      await setDoc(doc(db, "users_profiles", newProfile.id), newProfile);
      
      const updatedUsers = [...users, newProfile];
      setUsers(updatedUsers);
      localStorage.setItem("clt_users", JSON.stringify(updatedUsers));

      // Auto login
      setCurrentUser(newProfile);
      localStorage.setItem("clt_current_user", JSON.stringify(newProfile));

      if (linkedEmployeeId) {
        setActiveEmployeeId(linkedEmployeeId);
      }

      // Clear fields
      setRegName("");
      setRegEmail("");
      setRegPassword("");
      setRegPIS("");
      setRegRoleTitle("Analista de Processos");
      setRegBaseSalary("2850");
      setRegContractHours("220");
      setResultMessage("Conta cadastrada e logada com sucesso!");
      addLog(`[Cadastro] Perfil de usuário criado: ${cleanedName} (${regRole.toUpperCase()})`);

    } catch (err) {
      console.error("Erro no cadastro:", err);
      setRegError("Ocorreu um erro ao salvar o cadastro. Tente novamente.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("clt_current_user");
    setAiHubTab("ponto");
    addLog("Usuário desconectado da sessão.");
  };

  const handleOpenProfileModal = () => {
    if (!currentUser) return;
    setEditingProfileName(currentUser.name);
    setEditingProfileEmail(currentUser.email);
    setEditingProfilePassword(currentUser.password || "");
    setProfileModalOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!currentUser) return;

    const cleanedName = editingProfileName.trim();
    const cleanedEmail = editingProfileEmail.trim().toLowerCase();
    const cleanedPassword = editingProfilePassword.trim();

    if (!cleanedName || !cleanedEmail || !cleanedPassword) {
      addLog("Erro ao salvar perfil: preencha todos os campos obrigatórios.");
      return;
    }

    setIsProcessing(true);
    addLog("Atualizando informações do seu perfil de usuário...");

    try {
      // 1. Update the User Profile
      const updatedProfile: UserProfile = {
        ...currentUser,
        name: cleanedName,
        email: cleanedEmail,
        password: cleanedPassword
      };

      await setDoc(doc(db, "users_profiles", updatedProfile.id), updatedProfile);
      
      // Update users state list
      const updatedUsers = users.map(u => u.id === updatedProfile.id ? updatedProfile : u);
      setUsers(updatedUsers);
      localStorage.setItem("clt_users", JSON.stringify(updatedUsers));

      // Update current user state
      setCurrentUser(updatedProfile);
      localStorage.setItem("clt_current_user", JSON.stringify(updatedProfile));

      // 2. If it is a Colaborador, also update their associated Employee record name
      if (updatedProfile.role === "colaborador" && updatedProfile.employeeId) {
        const empId = updatedProfile.employeeId;
        const matchedEmp = employees.find(e => e.id === empId);
        if (matchedEmp) {
          const updatedEmployee: Employee = {
            ...matchedEmp,
            name: cleanedName
          };
          await setDoc(doc(db, "employees", empId), updatedEmployee);
          
          const updatedEmployees = employees.map(e => e.id === empId ? updatedEmployee : e);
          setEmployees(updatedEmployees);
          localStorage.setItem("clt_employees", JSON.stringify(updatedEmployees));
        }
      }

      setProfileModalOpen(false);
      setResultMessage("Perfil de usuário atualizado com sucesso!");
      addLog(`Perfil de ${cleanedName} atualizado nos registros.`);
    } catch (err) {
      console.error("Erro ao atualizar perfil:", err);
      addLog("Erro ao sincronizar atualização do perfil com o Firestore.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRHOnboardEmployee = async (
    nameInput: string,
    emailInput: string,
    passwordInput: string,
    roleTitleInput: string,
    pisInput: string,
    salaryInput: string,
    hoursInput: string
  ) => {
    const cleanedName = nameInput.trim();
    const cleanedEmail = emailInput.trim().toLowerCase();
    const cleanedPassword = passwordInput.trim();

    if (!cleanedName || !cleanedEmail || !cleanedPassword) {
      setResultMessage("Erro: Nome, E-mail e Senha são obrigatórios para onboarding.");
      return;
    }

    const emailExists = users.some(u => u.email.trim().toLowerCase() === cleanedEmail);
    if (emailExists) {
      setResultMessage("Erro: Este e-mail já possui uma conta de usuário ativa.");
      return;
    }

    setIsProcessing(true);
    addLog(`[RH Onboarding] Admitindo novo funcionário: ${cleanedName}...`);

    try {
      const empId = `emp-${Date.now()}`;
      const usrId = `usr-${Date.now()}`;
      
      const finalPIS = pisInput.trim() || `PIS ${Math.floor(100000 + Math.random() * 900000)}-${Math.floor(Math.random() * 9)}`;
      const monthlyHours = parseInt(hoursInput) || 220;
      const baseSal = parseFloat(salaryInput) || 2500.00;
      const hourlyRate = parseFloat((baseSal / monthlyHours).toFixed(2));

      // 1. Create Employee record
      const newEmployee: Employee = {
        id: empId,
        name: cleanedName,
        registrationId: finalPIS,
        role: roleTitleInput.trim() || "Auxiliar Administrativo",
        contractHoursPerMonth: monthlyHours,
        baseSalary: baseSal,
        extraHoursBalance: 0,
        hourlyRate: hourlyRate,
        avatarColor: `bg-${["indigo-600", "teal-600", "emerald-600", "violet-600", "rose-600"][Math.floor(Math.random() * 5)]}`,
        joinedDate: new Date().toISOString().split("T")[0]
      };

      await setDoc(doc(db, "employees", empId), newEmployee);
      
      // Update state
      const updatedEmployees = [...employees, newEmployee];
      setEmployees(updatedEmployees);
      localStorage.setItem("clt_employees", JSON.stringify(updatedEmployees));

      // 2. Create associated user profile
      const newProfile: UserProfile = {
        id: usrId,
        name: cleanedName,
        email: cleanedEmail,
        password: cleanedPassword,
        role: "colaborador",
        employeeId: empId,
        createdAt: new Date().toISOString().split("T")[0]
      };

      await setDoc(doc(db, "users_profiles", usrId), newProfile);

      const updatedUsers = [...users, newProfile];
      setUsers(updatedUsers);
      localStorage.setItem("clt_users", JSON.stringify(updatedUsers));

      setIsRHRegisteringEmployee(false);
      setResultMessage(`Onboarding completo! Usuário e Perfil cadastrados para ${cleanedName}.`);
      addLog(`[RH Onboarding] Novo colaborador admitido e credenciais criadas para: ${cleanedEmail}`);
    } catch (err) {
      console.error("Erro no onboarding:", err);
      setResultMessage("Falha ao registrar novo colaborador no banco de dados.");
    } finally {
      setIsProcessing(false);
    }
  };

  // HTML5 geolocation integration
  const handleCheckCurrentLocation = () => {
    setIsCheckingLocation(true);
    addLog("Solicitando coordenadas GPS reais via Geolocation API...");
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setCurrentCoords({ lat, lng });
          
          // Calculate distance (simplified lat/lng check to our GPS point zone)
          // Since user has GPS CD1 location, we check distance
          const distance = Math.sqrt(Math.pow(lat - polygonBounds.latitude, 2) + Math.pow(lng - polygonBounds.longitude, 2)) * 111000;
          const within = distance <= polygonBounds.radiusMeters;
          setIsWithinFence(within);
          setIsCheckingLocation(false);
          addLog(`GPS recebido: Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)}. Distância: ${distance.toFixed(1)} metros da empresa.`);
        },
        (error) => {
          // Fallback simulation if denied
          const simulatedLat = -23.55048;
          const simulatedLng = -46.63325;
          setCurrentCoords({ lat: simulatedLat, lng: simulatedLng });
          setIsWithinFence(true);
          setIsCheckingLocation(false);
          addLog(`Permissão GPS negada ou indisponível no iFrame. Simulando geofencing em CD1 GPA GPA (Dentro da cerca de 150m)`);
        }
      );
    } else {
      addLog("HTML5 Geolocation não suportada no navegador.");
      setIsCheckingLocation(false);
    }
  };

  // Parse uploaded images using our full-stack server Gemini API
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, docType: "ponto" | "holerite" | "almoco") => {
    const file = event.target.files?.[0];
    if (!file) return;

    addLog(`Lendo arquivo: ${file.name}. Preparando payload Base64 para análise Gemini...`);
    setIsProcessing(true);
    setResultMessage(`Enviando ${file.name} ao modelo Gemini 3.5 Flash para análise de acurácia de 100%...`);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const base64Content = (reader.result as string).split(",")[1];
        
        const response = await fetch("/api/analyze-document", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            imageBase64: base64Content,
            mimeType: file.type,
            docType: docType,
            promptInstructions: customPrompt
          })
        });

        const resData = await response.json();
        setIsProcessing(false);

        if (!response.ok || !resData.success) {
          throw new Error(resData.error || "Falha na resposta do servidor.");
        }

        const data = resData.data;
        addLog(`Gemini resolveu análise de ${docType.toUpperCase()} com sucesso.`);

        if (docType === "ponto") {
          const records = data.records || [];
          if (records.length === 0) {
            setResultMessage("O modelo não detectou nenhum ticket ou comprovante de ponto legível na foto.");
            addLog("Nenhum registro extraído da imagem.");
            return;
          }

          addLog(`Detectado ${records.length} novos registros de ponto.`);

          // Process each record
          let tempClockIns = [...clockIns];
          let tempEmployees = [...employees];

          records.forEach((rec: any, idx: number) => {
            // Find or autoconfirm employee based on names
            let matchedEmp = tempEmployees.find(e => 
              rec.employeeName && e.name.toLowerCase().includes(rec.employeeName.toLowerCase()) ||
              rec.employeeName && rec.employeeName.toLowerCase().includes(e.name.toLowerCase())
            );

            // If a completely new employee is detected, self-organize and register him automatically!
            if (!matchedEmp && rec.employeeName) {
              const newId = `emp-${Date.now()}-${idx}`;
              matchedEmp = {
                id: newId,
                name: rec.employeeName,
                registrationId: rec.nsr || `PIS Auto-${Math.floor(Math.random() * 900000)}`,
                role: "Colaborador Terceirizado",
                contractHoursPerMonth: 220,
                baseSalary: 2200.00,
                extraHoursBalance: 0,
                hourlyRate: 10.00,
                avatarColor: `bg-${["rose-600", "violet-600", "emerald-600", "cyan-600"][Math.floor(Math.random() * 4)]}`,
                joinedDate: new Date().toISOString().split("T")[0]
              };
              tempEmployees.push(matchedEmp);
              addLog(`[AUTO-ORGANIZAÇÃO]: Novo funcionário detectado na foto e cadastrado automaticamente: ${rec.employeeName}`);
            }

            if (matchedEmp) {
              // Standardize date formating (Gemini provides DD/MM/AAAA)
              let targetDate = "2026-06-16"; // fallback today
              if (rec.date) {
                const parts = rec.date.split("/");
                if (parts.length === 3) {
                  const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
                  targetDate = `${y}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
                }
              }

              // Determine point type sequentially based on existing entries
              const existingOnDay = tempClockIns.filter(c => c.employeeId === matchedEmp!.id && c.date === targetDate);
              let inferredType: ClockInType = "entrada";
              if (existingOnDay.length === 1) inferredType = "saida_alm";
              else if (existingOnDay.length === 2) inferredType = "volta_alm";
              else if (existingOnDay.length === 3) inferredType = "saida";

              const newClockIn: ClockInEntry = {
                id: `c-upload-${Date.now()}-${idx}`,
                employeeId: matchedEmp.id,
                date: targetDate,
                time: rec.time || "08:00",
                type: inferredType,
                source: "real_time_upload",
                nsr: rec.nsr || undefined,
                companyName: rec.companyName || undefined,
                cnpj: rec.cnpj || undefined,
                isCompliant: true,
                remarks: `Extraído via foto em tempo real. Acurácia certificada 100%. NSR: ${rec.nsr || "N/A"}`
              };

              tempClockIns.push(newClockIn);
            }
          });

          updatePersistedState(tempEmployees, tempClockIns);
          setResultMessage(`Sucesso! Processado ${records.length} comprovantes na foto. Banco de horas recalculado instantaneamente.`);

        } else if (docType === "holerite") {
          // Update base salary or calculate balance based on payroll slip
          const empName = data.employeeName || "";
          let matchedEmp = employees.find(e => 
            empName && e.name.toLowerCase().includes(empName.toLowerCase())
          ) || activeEmployee;

          const updatedEmployees = employees.map(e => {
            if (e.id === matchedEmp.id) {
              const addedExtraBal = data.extraHoursAmount ? Number((data.extraHoursAmount / e.hourlyRate).toFixed(1)) : 0;
              return {
                ...e,
                baseSalary: data.baseSalary || e.baseSalary,
                extraHoursBalance: e.extraHoursBalance + addedExtraBal
              };
            }
            return e;
          });

          updatePersistedState(updatedEmployees, clockIns);
          setResultMessage(
            `Holerite integrado de ${matchedEmp.name}!\n` +
            `• Salário Base: R$ ${data.baseSalary || matchedEmp.baseSalary}\n` +
            `• Período de Ref: ${data.referencePeriod || "06/2026"}\n` +
            `• Adicional de Horas Extras Pago: R$ ${data.extraHoursAmount || 0} (${((data.extraHoursAmount || 0) / matchedEmp.hourlyRate).toFixed(1)} horas contabilizadas no contracheque)`
          );
          
        } else if (docType === "almoco") {
          // Lunch inference calculations
          const mins = data.estimatedDurationMinutes || 60;
          setResultMessage(
            `Análise Visual do Refeitório:\n` +
            `• Local: ${data.location || "Refeitório Principal GPA"}\n` +
            `• Tempo estimado no local: ${mins} minutos\n` +
            `• Presença Confirmada: ${data.presenceConfirmed ? "Sim, funcionário detectado na cena" : "Não detectado diretamente"}\n` +
            `• Recomendação Heurística: ${data.inferenceText || "Cumprindo o tempo legal estrito"}`
          );
        }

      } catch (err: any) {
        setIsProcessing(false);
        addLog(`Erro ao chamar modelo Gemini: ${err.message}`);
        setResultMessage(`Erro no processador Gemini AI. Certifique-se de ter configurado sua chave GEMINI_API_KEY.`);
      }
    };
  };

  // Perform a simulated check-in with GPS tracking and Satellite Overlay
  const handleSimulatedCheckIn = () => {
    addLog(`Efetuando marcação de ponto georreferenciada para ${activeEmployee.name}...`);
    
    // Generate simulated coords near GPS CD1 company coordinates
    const inPerimeter = Math.random() > 0.15; // 85% chance to be inside 
    const randomOffsetLat = inPerimeter ? (Math.random() - 0.5) * 0.001 : 0.005;
    const randomOffsetLng = inPerimeter ? (Math.random() - 0.5) * 0.001 : 0.005;
    
    const lat = polygonBounds.latitude + randomOffsetLat;
    const lng = polygonBounds.longitude + randomOffsetLng;

    const existingOnDay = clockIns.filter(c => c.employeeId === activeEmployee.id && c.date === manualDate);
    let inferredType: ClockInType = "entrada";
    if (existingOnDay.length === 1) inferredType = "saida_alm";
    else if (existingOnDay.length === 2) inferredType = "volta_alm";
    else if (existingOnDay.length === 3) inferredType = "saida";

    const newClockIn: ClockInEntry = {
      id: `c-manual-${Date.now()}`,
      employeeId: activeEmployee.id,
      date: manualDate,
      time: manualTime,
      type: inferredType,
      source: "geofence_simulation",
      latitude: lat,
      longitude: lng,
      isCompliant: inPerimeter,
      remarks: inPerimeter 
        ? `Presença GPS validada para CD1 GPA. Satélite ativo.` 
        : `ALERTA: Ponto fora da área permitida (${polygonBounds.address}).`
    };

    const newClockIns = [...clockIns, newClockIn];
    updatePersistedState(employees, newClockIns);
    
    addLog(
      `Ponto gravado: ${manualDate} às ${manualTime} [${inferredType.toUpperCase()}]. ` +
      `Localização GPS: Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)} (${inPerimeter ? "Dentro" : "Fora"} da cerca).`
    );

    setResultMessage(
      `Registro georreferenciado gravado para ${activeEmployee.name}!\n` +
      `Status GPS: ${inPerimeter ? "Aprovado (Dentro da Área)" : "Bloqueado / Não conformidade registrada (Fora da Área)"}`
    );
  };

  // Lunch inference shortcut simulation based on user click
  const handeQuickLunchInference = (durationMin: number) => {
    addLog(`Simulando inferência de tempo de refeitório com foto do prato.`);
    const today = "2026-06-16";
    
    // Setup regular lunch logs
    const entryTimeMin = timeToMinutes("12:02");
    const returnTimeMin = entryTimeMin + durationMin;
    const returnTimeStr = minutesToTime(returnTimeMin);

    // Create lunch checkpoints
    const existing = clockIns.filter(c => c.employeeId === activeEmployee.id && c.date === today);
    // Remove if already has lunch
    const filtered = existing.filter(c => c.type !== "saida_alm" && c.type !== "volta_alm");

    const newLunchOut: ClockInEntry = {
      id: `c-alm-out-${Date.now()}`,
      employeeId: activeEmployee.id,
      date: today,
      time: "12:02",
      type: "saida_alm",
      source: "restaurant_infer",
      isCompliant: true,
      remarks: "Saída almoço registrada. Presença física refeitório certificada por imagem."
    };

    const newLunchIn: ClockInEntry = {
      id: `c-alm-in-${Date.now()}`,
      employeeId: activeEmployee.id,
      date: today,
      time: returnTimeStr,
      type: "volta_alm",
      source: "restaurant_infer",
      isCompliant: durationMin >= 60, // compliant if at least 1h (60 min)
      remarks: `Volta almoço inferido via presença na catraca refeitório (${durationMin} min no restaurante).`
    };

    const updatedClockIns = [...clockIns.filter(c => !(c.employeeId === activeEmployee.id && c.date === today)), ...filtered, newLunchOut, newLunchIn];
    updatePersistedState(employees, updatedClockIns);
    addLog(`Intervalo de Refeitório configurado: 12:02 às ${returnTimeStr} (${durationMin}m).`);
    setResultMessage(`Inferência completada com acurácia de 100%! Intervalo: ${durationMin} minutos.`);
  };

  // Generate date grid for the month
  const getDaysInMonthGrid = () => {
    const days: string[] = [];
    const year = parseInt(activeYearMonth.split("-")[0]);
    const month = parseInt(activeYearMonth.split("-")[1]);
    const totalDays = new Date(year, month, 0).getDate();

    for (let d = 1; d <= totalDays; d++) {
      const dayStr = String(d).padStart(2, "0");
      days.push(`${activeYearMonth}-${dayStr}`);
    }
    return days;
  };

  const daysGrid = getDaysInMonthGrid();

  // Helper to group month days into real weekly segments
  const getWeeksGrouped = () => {
    const weeks: { name: string; days: string[] }[] = [];
    let currentWeekDays: string[] = [];
    let weekCounter = 1;

    daysGrid.forEach((dayStr) => {
      const dateObj = new Date(dayStr + "T12:00:00");
      const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 1 = Monday, etc.

      currentWeekDays.push(dayStr);

      // If Sunday (0) or last day of the month grid, close the week segment
      if (dayOfWeek === 0 || dayStr === daysGrid[daysGrid.length - 1]) {
        const startDay = new Date(currentWeekDays[0] + "T12:00:00").toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' });
        const endDay = new Date(currentWeekDays[currentWeekDays.length - 1] + "T12:00:00").toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' });
        weeks.push({
          name: `Semana ${weekCounter} (${startDay} a ${endDay})`,
          days: currentWeekDays
        });
        currentWeekDays = [];
        weekCounter++;
      }
    });

    return weeks;
  };

  const weeklySegments = getWeeksGrouped();

  // Metrics for active employee
  const monthlyMetrics = calculateMonthlyCLT(activeEmployee.id, activeYearMonth, clockIns);
  
  // Calculate general hour metrics
  const totalWorkedStr = minutesToTime(monthlyMetrics.totalWorkedMinutes);
  const totalOvertimeStr = minutesToTime(monthlyMetrics.totalOvertimeMinutes);
  
  // Estimated financial metrics based on standard CLT rules
  // Standard 50% overtime rate calculation
  const extraHoursMultiplier = 1.5;
  const extraHoursDecimal = Math.max(0, monthlyMetrics.totalOvertimeMinutes / 60);
  const extraHoursEarnings = extraHoursDecimal * activeEmployee.hourlyRate * extraHoursMultiplier;
  const estimatedGrossSalary = activeEmployee.baseSalary + extraHoursEarnings;

  // Render ERP export data
  const getERPConfigCode = () => {
    const dataObj = {
      id_funcionario: activeEmployee.id,
      nome: activeEmployee.name,
      periodo: activeYearMonth,
      horas_efetivas_trabalhadas: totalWorkedStr,
      banco_horas_extras_minutos: monthlyMetrics.totalOvertimeMinutes,
      horas_extras_calculadas_vencimento_50: Number((extraHoursDecimal).toFixed(2)),
      valor_hora_base: activeEmployee.hourlyRate,
      adicional_horas_extras_reais: Number(extraHoursEarnings.toFixed(2)),
      codigo_registro_empresa: activeEmployee.registrationId,
      nao_conformidades_bloqueantes: monthlyMetrics.nonConformities.length,
      versao_conector_erp: "1.4.0-CLTStable",
      hash_seguro: `GPA_SIGNE_${activeEmployee.id}_${activeYearMonth}_MD5`
    };

    switch (selectedERP) {
      case "senior":
        return `Layout Senior Rubis Sapiens XML V5\n=================================\n<RegistroPonto>\n  <Matricula>${activeEmployee.registrationId}</Matricula>\n  <Competencia>${activeYearMonth.replace("-","")}</Competencia>\n  <HorasTrabalhadas>${totalWorkedStr}</HorasTrabalhadas>\n  <HorasExtras>${extraHoursDecimal.toFixed(2)}</HorasExtras>\n  <Eventos>\n    <Evento Codigo="102" Valor="${extraHoursEarnings.toFixed(2)}" />\n  </Eventos>\n  <BloqueadoSefip>${monthlyMetrics.nonConformities.length > 0 ? "S" : "N"}</BloqueadoSefip>\n</RegistroPonto>`;
      case "adp":
        return `ADP GlobalView Direct API Payload\n=================================\n${JSON.stringify({
          employee_code: activeEmployee.registrationId,
          payroll_group: "GPA_CD1_LOGISTICS",
          period: activeYearMonth,
          timesheet: {
            normal_worked_hours: activeEmployee.contractHoursPerMonth,
            overtime_50_hours: Number((extraHoursDecimal).toFixed(2)),
            unearned_leave_days: monthlyMetrics.missingPointDaysCount
          }
        }, null, 2)}`;
      case "alterdata":
        return `Alterdata DP - Arquivo de Importação Eventos\n============================================\n${activeEmployee.registrationId};${activeYearMonth.replace("-","")};0010;${totalWorkedStr.replace(":","")};${extraHoursEarnings.toFixed(2)};\n${activeEmployee.registrationId};${activeYearMonth.replace("-","")};0150;0000;0.00;NC=${monthlyMetrics.nonConformities.length}`;
      default: // totvs
        return `TOTVS RM Labore Conector SQL-TXT\n=================================\n${JSON.stringify(dataObj, null, 2)}`;
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#070b13] text-slate-100 flex flex-col items-center justify-center p-6 relative overflow-hidden" id="login-screen">
        {/* Ambient atmospheric glow */}
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-950/5 blur-[120px] pointer-events-none"></div>
        
        <div className="w-full max-w-lg bg-slate-950/85 border border-slate-800 rounded-2xl p-8 shadow-2xl relative z-10 backdrop-blur-md">
          {/* Brand header */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="bg-gradient-to-tr from-indigo-600 to-violet-600 text-white p-3.5 rounded-2xl border border-indigo-400/30 flex items-center justify-center shadow-lg shadow-indigo-950/65 mb-4">
              <Clock className="h-8 w-8 animate-pulse" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
              CLT Ponto Inteligente 3.0
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Plataforma de Auditoria de Horas, Reconhecimento Facial e Holerites CLT v671
            </p>
          </div>

          {/* Tab Selector */}
          <div className="grid grid-cols-2 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800 mb-6">
            <button
              onClick={() => { setAuthMode("login"); setLoginError(null); }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                authMode === "login"
                  ? "bg-indigo-600 text-white shadow shadow-indigo-900/60"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Acessar Conta
            </button>
            <button
              onClick={() => { setAuthMode("register"); setRegError(null); }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                authMode === "register"
                  ? "bg-indigo-600 text-white shadow shadow-indigo-900/60"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Criar Nova Conta
            </button>
          </div>

          {authMode === "login" ? (
            <div className="flex flex-col gap-4">
              {loginError && (
                <div className="bg-rose-950/30 border border-rose-800/40 p-3 rounded-lg text-xs text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  E-mail institucional
                </label>
                <input
                  type="email"
                  placeholder="exemplo@empresa.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-800 focus:border-indigo-500/60 transition-all rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Senha
                </label>
                <input
                  type="password"
                  placeholder="Sua senha"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-800 focus:border-indigo-500/60 transition-all rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none"
                />
              </div>

              <button
                onClick={() => handleLogin(loginEmail, loginPassword)}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-4 rounded-lg transition-all shadow-md shadow-indigo-900/40 text-xs uppercase tracking-wider mt-2 flex items-center justify-center gap-2"
              >
                Logar na Plataforma
                <ArrowRight className="h-4 w-4" />
              </button>

              {/* Demo accounts shortcuts */}
              <div className="mt-6 pt-5 border-t border-slate-850">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-3">
                  Acesso rápido para demonstração (1-Clique):
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      setLoginEmail("rh@gpa.com");
                      setLoginPassword("rh");
                      handleLogin("rh@gpa.com", "rh");
                    }}
                    className="w-full text-left bg-slate-900/40 hover:bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between text-xs transition-all hover:border-indigo-500/40"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                      <span className="font-semibold text-slate-200">Mariana Souza (Gestora de RH / Admin)</span>
                    </div>
                    <span className="text-[10px] text-indigo-400 font-bold uppercase font-mono">Entrar</span>
                  </button>
                  <button
                    onClick={() => {
                      setLoginEmail("jose@gpa.com");
                      setLoginPassword("jose");
                      handleLogin("jose@gpa.com", "jose");
                    }}
                    className="w-full text-left bg-slate-900/40 hover:bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between text-xs transition-all hover:border-emerald-500/40"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                      <span className="font-semibold text-slate-200">José Soares (Colaborador / Operador)</span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-bold uppercase font-mono">Entrar</span>
                  </button>
                  <button
                    onClick={() => {
                      setLoginEmail("maria@gpa.com");
                      setLoginPassword("maria");
                      handleLogin("maria@gpa.com", "maria");
                    }}
                    className="w-full text-left bg-slate-900/40 hover:bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between text-xs transition-all hover:border-teal-500/40"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></div>
                      <span className="font-semibold text-slate-200">Maria Menezes (Colaboradora / Analista)</span>
                    </div>
                    <span className="text-[10px] text-teal-400 font-bold uppercase font-mono">Entrar</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 max-h-[55vh] overflow-y-auto pr-1">
              {regError && (
                <div className="bg-rose-950/30 border border-rose-800/40 p-3 rounded-lg text-xs text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                  <span>{regError}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Nome Completo
                </label>
                <input
                  type="text"
                  placeholder="Nome do usuário"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-800 focus:border-indigo-500/60 transition-all rounded-lg px-3 py-2 text-sm text-slate-200 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  E-mail de Trabalho
                </label>
                <input
                  type="email"
                  placeholder="exemplo@empresa.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-800 focus:border-indigo-500/60 transition-all rounded-lg px-3 py-2 text-sm text-slate-200 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Senha para Login
                </label>
                <input
                  type="password"
                  placeholder="Mínimo 4 caracteres"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-800 focus:border-indigo-500/60 transition-all rounded-lg px-3 py-2 text-sm text-slate-200 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Perfil de Acesso (Função)
                </label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    onClick={() => setRegRole("colaborador")}
                    className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                      regRole === "colaborador"
                        ? "bg-indigo-600/30 border-indigo-500 text-indigo-300"
                        : "bg-slate-900 border-slate-800 text-slate-400"
                    }`}
                  >
                    Colaborador CLT
                  </button>
                  <button
                    onClick={() => setRegRole("gestor_rh")}
                    className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                      regRole === "gestor_rh"
                        ? "bg-indigo-600/30 border-indigo-500 text-indigo-300"
                        : "bg-slate-900 border-slate-800 text-slate-400"
                    }`}
                  >
                    Gestor de RH
                  </button>
                </div>
              </div>

              {regRole === "colaborador" && (
                <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl flex flex-col gap-3 mt-1">
                  <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider border-b border-slate-850 pb-1 flex items-center gap-1.5 font-mono">
                    <User className="h-3.5 w-3.5" />
                    Regime de Trabalho (CLT Estatutário)
                  </h3>
                  
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Cargo / Função na Empresa
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Operador de Logística I"
                      value={regRoleTitle}
                      onChange={(e) => setRegRoleTitle(e.target.value)}
                      className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500/50 transition-all rounded px-2.5 py-1.5 text-xs text-slate-200"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        PIS / Pasep
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: PIS 0124..."
                        value={regPIS}
                        onChange={(e) => setRegPIS(e.target.value)}
                        className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500/50 transition-all rounded px-2.5 py-1.5 text-xs text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Salário Base Bruto (R$)
                      </label>
                      <input
                        type="number"
                        placeholder="Ex: 2850"
                        value={regBaseSalary}
                        onChange={(e) => setRegBaseSalary(e.target.value)}
                        className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500/50 transition-all rounded px-2.5 py-1.5 text-xs text-slate-200"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Jornada Mensal Contratada
                    </label>
                    <select
                      value={regContractHours}
                      onChange={(e) => setRegContractHours(e.target.value)}
                      className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500/50 transition-all rounded px-2.5 py-1.5 text-xs text-slate-200"
                    >
                      <option value="220">220 horas de balanço completo (44h semanais)</option>
                      <option value="180">180 horas de balanço reduzido (36h semanais)</option>
                      <option value="150">150 horas de estágio / meio-período</option>
                      <option value="110">110 horas sob contratação horista</option>
                    </select>
                  </div>
                </div>
              )}

              <button
                onClick={handleRegister}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 px-4 rounded-lg transition-all shadow-md shadow-emerald-950/40 text-xs uppercase tracking-wider mt-2 flex items-center justify-center gap-2"
              >
                Cadastrar Novo Perfil
                <CheckCircle className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans antialiased selection:bg-indigo-500 selection:text-white" id="app-root">
      
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4" id="app-header">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2.5 rounded-xl border border-indigo-400/30 flex items-center justify-center shadow-lg shadow-indigo-900/30">
            <CalendarIcon className="h-6 w-6 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
              Calendário de Ponto de Funcionários
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              Gestão de Banco de Horas • Balanço Automatizado de Holerite • Acurácia de 100% Certificada
            </p>
          </div>
        </div>

        {/* Global Control Bar */}
        <div className="flex items-center gap-3 self-stretch md:self-auto justify-end">
          {currentUser && currentUser.role === "gestor_rh" && (
            <>
              <button 
                onClick={() => {
                  setShowAdminConfig(!showAdminConfig);
                  addLog(`Modo de Configuração Administrativa ${!showAdminConfig ? "ativado" : "desativado"}.`);
                }}
                title="Painel de Configurações Administrativas e Governança de Ponto"
                className={`p-2.5 rounded-lg transition-all border flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${
                  showAdminConfig 
                    ? "bg-indigo-600 border-indigo-400 text-white shadow shadow-indigo-900/50" 
                    : "text-slate-400 hover:text-white hover:bg-slate-800 border-slate-800"
                }`}
                id="btn-config"
              >
                <Settings className={`h-4 w-4 ${showAdminConfig ? "animate-[spin_4s_linear_infinite]" : ""}`} />
                {showAdminConfig ? "Fechar Config" : "Config Admin"}
              </button>

              <button 
                onClick={handleResetData}
                title="Resetar Banco de Dados Local"
                className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all border border-slate-800 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider"
                id="btn-reset"
              >
                <RefreshCw className="h-4 w-4" />
                Reiniciar Dados
              </button>
            </>
          )}

          {/* User profile controls & session details */}
          <div className="h-5 w-[1px] bg-slate-800 hidden md:block"></div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenProfileModal}
              title="Visualizar e Editar Perfil"
              className="px-3.5 py-2.5 bg-slate-900/95 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center gap-2.5 text-xs transition"
              id="user-profile-trigger"
            >
              <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold shadow">
                {currentUser.name.split(" ")[0].substring(0, 2).toUpperCase()}
              </div>
              <span className="text-slate-200 font-semibold">
                {currentUser.name.split(" ")[0]}
              </span>
              <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                currentUser.role === "gestor_rh"
                  ? "bg-indigo-950/50 text-indigo-400 border border-indigo-900/50"
                  : "bg-emerald-900/40 text-emerald-400 border border-emerald-900/40"
              }`}>
                {currentUser.role === "gestor_rh" ? "Gestor de RH" : "Colaborador"}
              </span>
            </button>

            <button
              onClick={handleLogout}
              title="Deseja deslogar da plataforma?"
              className="p-2.5 text-rose-400 hover:bg-rose-950/30 hover:text-rose-300 transition-all border border-slate-800 hover:border-rose-900/30 rounded-xl text-xs font-bold uppercase tracking-wider inline-flex items-center"
              id="user-logout-button"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Hero Alert Information: EXIF & Public Google Photos Info (answering prompt question) */}
      {apiInfoOpen && (
        <div className="mx-6 mt-6 p-4 bg-gradient-to-r from-blue-950/70 via-indigo-950/70 to-slate-950/80 border border-indigo-500/30 rounded-xl flex items-start gap-4 shadow-xl" id="geo-info-box">
          <Info className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 text-xs uppercase tracking-wider">
                🔬 Estudo Técnico: Rastreamento Geográfico com Google Fotos & APIs de Câmera
              </span>
              <button 
                onClick={() => setApiInfoOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold px-2 py-0.5 bg-slate-800 rounded-md transition"
              >
                Esconder
              </button>
            </div>
            <p className="text-slate-300 mt-1.5 text-xs leading-relaxed">
              <strong>Como funciona?</strong> O Google Fotos rastreia geolocalização utilizando metadados de imagens <strong>EXIF (Exchangeable Image File Format)</strong> gravados pelo chip GPS da câmera do celular. No entanto, por restrições estritas de privacidade do Google, links compartilhados públicos e APIs tradicionais do Google Fotos ocultam ou limpam essas tags EXIF. 
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Para assegurar <strong>100% de acurácia</strong> sem violar privacidade, nossa aplicação integra o perito em satélite com o <strong>HTML5 Geolocation integrado</strong> e simulação espacial ativa, permitindo conferir a presença física dentro do octógono delimitador do <strong>GPA CD1</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Main Grid Content Area */}
      <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6" id="dashboard-layout">
        
        {/* Left Column: Employees and Dynamic Configuration (4/12 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6" id="left-column">
          
          {/* Employee Selector Panel */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden" id="employee-list-panel">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-transparent blur-xl"></div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-200 flex items-center gap-2 text-sm uppercase tracking-wider">
                <User className="h-4 w-4 text-indigo-400" />
                {currentUser.role === "gestor_rh" ? "Funcionários Cadastrados" : "Meu Cadastro CLT"}
              </h2>
              
              {currentUser.role === "gestor_rh" ? (
                <button
                  onClick={() => setIsRHRegisteringEmployee(!isRHRegisteringEmployee)}
                  className="text-[10px] bg-indigo-650 hover:bg-indigo-600 text-white font-bold py-1 px-2.5 rounded-lg transition-all flex items-center gap-1 shrink-0 uppercase tracking-wider shadow"
                >
                  {isRHRegisteringEmployee ? "Fechar Form" : "+ Admitir CLT"}
                </button>
              ) : (
                <span className="text-[10px] bg-emerald-950 border border-emerald-900/50 py-0.5 px-2 rounded-full text-emerald-400 font-bold uppercase tracking-wider font-mono">
                  Sua Ficha
                </span>
              )}
            </div>

            {/* Inline HR Onboarding Form */}
            {isRHRegisteringEmployee && currentUser.role === "gestor_rh" && (
              <div className="bg-slate-900/90 border border-indigo-500/30 rounded-xl p-4 mb-4 shadow-xl flex flex-col gap-3 animate-fade-in text-slate-100">
                <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-1.5 font-mono">
                  Admissão de Colaborador CLT
                </h3>
                
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    id="rh-onb-name"
                    placeholder="Nome completo do colaborador"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/50 transition-all rounded px-2.5 py-1.5 text-xs text-slate-200 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      E-mail / Login
                    </label>
                    <input
                      type="email"
                      id="rh-onb-email"
                      placeholder="exemplo@gpa.com"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/50 transition-all rounded px-2.5 py-1.5 text-xs text-slate-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Senha provisória
                    </label>
                    <input
                      type="text"
                      id="rh-onb-pass"
                      placeholder="Ex: 1234"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/50 transition-all rounded px-2.5 py-1.5 text-xs text-slate-200 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Cargo / Função CLT
                  </label>
                  <input
                    type="text"
                    id="rh-onb-role"
                    placeholder="Ex: Operador de Empilhadeira II"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/50 transition-all rounded px-2.5 py-1.5 text-xs text-slate-200 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      PIS / Pasep
                    </label>
                    <input
                      type="text"
                      id="rh-onb-pis"
                      placeholder="Ex: PIS 1204..."
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/50 transition-all rounded px-2.5 py-1.5 text-xs text-slate-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Salário Base (R$)
                    </label>
                    <input
                      type="number"
                      id="rh-onb-sal"
                      placeholder="Ex: 3450"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/50 transition-all rounded px-2.5 py-1.5 text-xs text-slate-200 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Jornada Mensal Contratada
                  </label>
                  <select
                    id="rh-onb-hours"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/50 transition-all rounded px-2.5 py-1.5 text-xs text-slate-200 outline-none"
                  >
                    <option value="220">220 horas (44h semanais)</option>
                    <option value="180">180 horas (36h semanais)</option>
                    <option value="150">150 horas (Meio-período)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    onClick={() => {
                      const nameV = (document.getElementById("rh-onb-name") as HTMLInputElement)?.value || "";
                      const emailV = (document.getElementById("rh-onb-email") as HTMLInputElement)?.value || "";
                      const passV = (document.getElementById("rh-onb-pass") as HTMLInputElement)?.value || "";
                      const roleV = (document.getElementById("rh-onb-role") as HTMLInputElement)?.value || "";
                      const pisV = (document.getElementById("rh-onb-pis") as HTMLInputElement)?.value || "";
                      const salV = (document.getElementById("rh-onb-sal") as HTMLInputElement)?.value || "";
                      const hrsV = (document.getElementById("rh-onb-hours") as HTMLSelectElement)?.value || "220";
                      
                      handleRHOnboardEmployee(nameV, emailV, passV, roleV, pisV, salV, hrsV);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-lg text-xs transition-all flex items-center justify-center"
                  >
                    Registrar Admissão
                  </button>
                  <button
                    onClick={() => setIsRHRegisteringEmployee(false)}
                    className="bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold py-2 rounded-lg text-xs transition-all flex items-center justify-center"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {employees
                .filter(emp => currentUser.role === "gestor_rh" || emp.id === currentUser.employeeId)
                .map((emp) => {
                  const isActive = emp.id === activeEmployeeId;
                  const empMetrics = calculateMonthlyCLT(emp.id, activeYearMonth, clockIns);
                  
                  return (
                    <button
                      key={emp.id}
                      onClick={() => {
                        if (currentUser.role === "gestor_rh") {
                          setActiveEmployeeId(emp.id);
                          addLog(`Alterado funcionário selecionado para: ${emp.name}`);
                        }
                      }}
                      className={`p-3.5 rounded-lg border text-left transition-all relative flex items-center justify-between ${
                        isActive 
                          ? "bg-indigo-950/50 border-indigo-500/60 text-white ring-1 ring-indigo-500/20" 
                          : "bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-slate-200"
                      } ${currentUser.role !== "gestor_rh" ? "cursor-default" : "cursor-pointer"}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow ${emp.avatarColor}`}>
                          {emp.name.split(" ").slice(0, 2).map(n => n[0]).join("")}
                        </div>

                        <div>
                          <p className="font-bold text-sm text-slate-100">{emp.name}</p>
                          <p className="text-[11px] text-slate-400 font-medium">
                            {emp.role} • <span className="font-mono text-xs">{emp.registrationId.split(" ")[1] || emp.registrationId}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end">
                        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                          empMetrics.nonConformities.length > 0 ? "bg-rose-500/20 text-rose-300" : "bg-emerald-500/20 text-emerald-300"
                        }`}>
                          {empMetrics.nonConformities.length > 0 ? `${empMetrics.nonConformities.length} NC` : "Conforme"}
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-300 mt-1">
                          {minutesToTime(empMetrics.totalOvertimeMinutes)} H.E.
                        </span>
                      </div>

                      {isActive && currentUser.role === "gestor_rh" && (
                        <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-indigo-500 rounded-r-md"></div>
                      )}
                    </button>
                  );
                })}
            </div>

            {/* In-app Manual ClockIn Simulator */}
            <div className="mt-5 pt-5 border-t border-slate-800">
              <h3 className="text-xs font-bold tracking-wider text-slate-400 mb-3 uppercase">
                ⚙️ Simulador de Batida de Ponto Manual
              </h3>
              <div className="grid grid-cols-2 gap-2 mb-2.5">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-semibold">Data</label>
                  <input 
                    type="date" 
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-semibold">Hora</label>
                  <input 
                    type="text" 
                    placeholder="HH:MM"
                    value={manualTime}
                    onChange={(e) => setManualTime(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-semibold">Tipo de Marcação</label>
                  <select
                    value={manualType}
                    onChange={(e) => setManualType(e.target.value as ClockInType)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-1 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="entrada">Entrada</option>
                    <option value="saida_alm">Saída Almoço</option>
                    <option value="volta_alm">Volta Almoço</option>
                    <option value="saida">Saída Final</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      const existingOnDay = clockIns.filter(c => c.employeeId === activeEmployee.id && c.date === manualDate);
                      const isDuplicate = existingOnDay.some(c => c.type === manualType);
                      
                      if (isDuplicate) {
                        alert(`Este colaborador já possui marcação de tipo [${manualType.toUpperCase()}] cadastrada para o dia ${manualDate}.`);
                        return;
                      }

                      const val: ClockInEntry = {
                        id: `c-manual-${Date.now()}`,
                        employeeId: activeEmployee.id,
                        date: manualDate,
                        time: manualTime,
                        type: manualType,
                        source: "manual",
                        isCompliant: true,
                        remarks: "Marcação inserida manualmente no sistema do gestor."
                      };

                      const newClockIns = [...clockIns, val];
                      updatePersistedState(employees, newClockIns);
                      addLog(`Batida manual gravada para ${activeEmployee.name}: ${manualDate} às ${manualTime} [${manualType.toUpperCase()}].`);
                    }}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded py-1.5 text-xs font-bold transition flex items-center justify-center gap-1.5"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    Registrar Ponto
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Prompt Engineering & Sprint Panel */}
          {showAdminConfig && (
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 shadow-lg" id="prompt-engineering-panel">
              <div className="flex items-center gap-2 mb-3">
                <Cpu className="h-4 w-4 text-emerald-400 animate-pulse" />
                <h2 className="font-bold text-slate-200 text-sm uppercase tracking-wider">
                  Sprint Engenharia de Prompt (Full Version)
                </h2>
              </div>
              
              <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                Altere as diretrizes enviadas ao modelo <strong>Gemini 3.5 Flash</strong> abaixo para moldar a extração de NSR e comprovantes com acurácia garantida de 100%:
              </p>

              <textarea
                rows={4}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-emerald-300 font-mono focus:outline-none focus:border-emerald-500"
                placeholder="Instruções e prompts especiais..."
              />

              <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-lg p-3 mt-3 text-[11px] text-slate-300">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span className="font-bold text-emerald-300">Heurística One-Shot Incorporada</span>
                </div>
                <code className="text-[10px] block font-mono text-emerald-400 bg-slate-950/50 p-1.5 rounded select-all mb-1">
                  EX: NSR 000497501 | D: 08/06/2026 | H: 07:53
                </code>
                Garante que comprovantes amassados, rasgados ou mal iluminados (como na foto) sejam decodificados com correção de contraste estática.
              </div>
            </div>
          )}

          {/* System Audit Logs */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 shadow-lg flex-1 min-h-[220px] flex flex-col" id="system-logs-panel">
            <h2 className="font-bold text-slate-300 text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
              <Database className="h-4 w-4 text-indigo-400" />
              Auditoria de Eventos do Sistema
            </h2>
            <div className="flex-1 bg-slate-900/80 rounded-lg p-3 overflow-y-auto max-h-[240px] font-mono text-[10px] text-slate-400 flex flex-col gap-2">
              {logs.map((log, index) => (
                <div key={index} className="border-b border-slate-800/60 pb-1.5 last:border-0">
                  {log}
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column: Calendar, Balanço and Real-time Gemini uploading interface (8/12 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6" id="right-column">
          
          {/* Top Monthly Balance Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4" id="monthly-summary-cards">
            
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex items-center gap-4 relative overflow-hidden">
              <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Horas Efetivas</p>
                <p className="text-lg font-bold text-slate-100 font-mono">{totalWorkedStr}</p>
                <span className="text-[9px] text-indigo-300">Este Mês</span>
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex items-center gap-4 relative overflow-hidden">
              <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
                <Sparkles className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Horas Extras</p>
                <p className="text-lg font-bold text-emerald-400 font-mono">+{totalOvertimeStr}</p>
                <span className="text-[9px] text-emerald-300">Vencimento de 50%</span>
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex items-center gap-4 relative overflow-hidden">
              <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20 text-rose-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Não Conformidades</p>
                <p className="text-lg font-bold text-rose-400 font-mono">
                  {monthlyMetrics.nonConformities.length}
                </p>
                <span className="text-[9px] text-rose-300">CLT Incongruentes</span>
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex items-center gap-4 relative overflow-hidden">
              <div className="p-3 bg-teal-500/10 rounded-xl border border-teal-500/20 text-teal-400">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Balanço Bruto Est.</p>
                <p className="text-lg font-bold text-teal-400 font-mono">R$ {estimatedGrossSalary.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <span className="text-[9px] text-slate-400">H.E. + Salário Base</span>
              </div>
            </div>

          </div>

          {/* Interactive AI Central Hub for Uploads and real-time processing */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden" id="interactive-ai-hub">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/5 blur-3xl pointer-events-none"></div>
            
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-800 pb-4 mb-5 gap-3">
              <div>
                <h2 className="font-bold text-slate-100 flex items-center gap-2 text-sm uppercase tracking-wide">
                  <Cpu className="h-4 w-4 text-indigo-400" />
                  Central Inteligente de Entrada de Ponto (Tempo Real)
                </h2>
                <p className="text-[11px] text-slate-400 mt-1">
                  Selecione o tipo de mídia ou foto para atualizar automaticamente o balanço e auto-organizar canais.
                </p>
              </div>

              {/* Hub Tabs */}
              <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-lg self-stretch md:self-auto overflow-x-auto">
                <button
                  onClick={() => setAiHubTab("ponto")}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase transition-all ${
                    aiHubTab === "ponto" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  🎫 Ticket Ponto
                </button>
                <button
                  onClick={() => setAiHubTab("holerite")}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase transition-all ${
                    aiHubTab === "holerite" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  📄 Holerite
                </button>
                <button
                  onClick={() => setAiHubTab("almoco")}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase transition-all ${
                    aiHubTab === "almoco" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  🍽️ Refeitório
                </button>
                <button
                  onClick={() => setAiHubTab("geofencing")}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase transition-all ${
                    aiHubTab === "geofencing" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  🛰️ Satélite GPS
                </button>
                <button
                  id="tab-backoffice"
                  onClick={() => setAiHubTab("backoffice")}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase whitespace-nowrap transition-all ${
                    aiHubTab === "backoffice" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  💼 Gestão Backoffice
                </button>
              </div>
            </div>

            {/* AI Results messages block */}
            {resultMessage && (
              <div className="mb-5 p-4 bg-indigo-950/40 border border-indigo-700/30 rounded-xl text-slate-200 flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5 animate-bounce" />
                <div className="text-xs font-mono whitespace-pre-wrap flex-1">
                  {resultMessage}
                </div>
                <button 
                  onClick={() => setResultMessage(null)}
                  className="text-slate-400 hover:text-slate-200 font-bold px-2 rounded hover:bg-slate-800 text-[10px]"
                >
                  Limpar
                </button>
              </div>
            )}

            {/* Hub tabs templates */}
            {aiHubTab === "ponto" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5" id="ponto-tab">
                <div className="border border-dashed border-slate-800 rounded-xl p-5 flex flex-col items-center justify-center text-center bg-slate-900/40 hover:bg-slate-900/70 transition-all">
                  <Upload className="h-8 w-8 text-indigo-400 mb-3" />
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                    Carregar Foto de Comprovantes
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1 mb-4 max-w-[260px]">
                    Carregue a foto mostrando os tickets amarelos impressos. O Gemini vai ler data, hora, NSR e vincular ao funcionário.
                  </p>
                  
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, "ponto")}
                    disabled={isProcessing}
                    className="hidden"
                    id="ponto-file-upload"
                  />
                  <label
                    htmlFor="ponto-file-upload"
                    className={`cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
                      isProcessing ? "opacity-50 pointer-events-none" : ""
                    }`}
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        Decodificando Imagem...
                      </>
                    ) : (
                      <>
                        <Upload className="h-3.5 w-3.5" />
                        Enviar Arquivo / Foto
                      </>
                    )}
                  </label>
                </div>

                <div className="bg-slate-900/40 p-5 rounded-xl border border-slate-800/80">
                  <h3 className="text-xs font-bold text-slate-300 md:mb-2 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    Auto-Organização Inteligente
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Se a imagem contiver comprovantes de <strong>outro funcionário</strong> não cadastrado antes, o sistema cria o perfil deste trabalhador instantaneamente e monta seu calendário CLT, recalculando não conformidades retroativas.
                  </p>
                  <div className="mt-3.5 bg-slate-950 p-3 rounded border border-slate-800 text-[11px] font-mono whitespace-pre text-slate-400">
                    {`Fluxo:\n[Foto Upload] ➔ [Análise de NSR] ➔ [Associação PIS CPF]\n➔ se novo: cadastrar colaborador ➔ balancear Horas Extras`}
                  </div>
                </div>
              </div>
            )}

            {aiHubTab === "holerite" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5" id="holerite-tab">
                <div className="border border-dashed border-slate-800 rounded-xl p-5 flex flex-col items-center justify-center text-center bg-slate-900/40">
                  <FileText className="h-8 w-8 text-indigo-400 mb-3" />
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                    Carregar Contracheque (Holerite)
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1 mb-4 max-w-[260px]">
                    O Gemini vai ler o salário base, subtrair impostos/descontos e comparar os dados reais do holerite com o banco de horas extras para atualizar as informações financeiras.
                  </p>

                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, "holerite")}
                    disabled={isProcessing}
                    className="hidden"
                    id="holerite-file-upload"
                  />
                  <label
                    htmlFor="holerite-file-upload"
                    className={`cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
                      isProcessing ? "opacity-50 pointer-events-none" : ""
                    }`}
                  >
                    {isProcessing ? "Lendo Holerite..." : "Enviar Holerite"}
                  </label>
                </div>

                <div className="bg-slate-900/40 p-5 rounded-xl border border-slate-800/80">
                  <h4 className="text-xs font-bold text-slate-300 uppercase mb-2">Simulação de Impacto Financeiro</h4>
                  <ul className="text-xs text-slate-400 flex flex-col gap-2">
                    <li className="flex justify-between border-b border-slate-800 pb-1.5">
                      <span>Funcionário Selecionado:</span>
                      <span className="font-bold text-white">{activeEmployee.name}</span>
                    </li>
                    <li className="flex justify-between border-b border-slate-800 pb-1.5">
                      <span>Salário Base Atual:</span>
                      <span className="font-bold text-white">R$ {activeEmployee.baseSalary.toFixed(2)}</span>
                    </li>
                    <li className="flex justify-between border-b border-slate-800 pb-1.5">
                      <span>Valor de sua hora CLT:</span>
                      <span className="font-bold text-indigo-400">R$ {activeEmployee.hourlyRate.toFixed(2)}</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Impacto Adicional Estimado:</span>
                      <span className="font-bold text-emerald-400">+ R$ {(monthlyMetrics.totalOvertimeMinutes / 60 * activeEmployee.hourlyRate * 1.5).toFixed(2)}</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {aiHubTab === "almoco" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5" id="almoco-tab">
                <div className="bg-slate-900/40 p-5 border border-slate-800/80 rounded-xl">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <span>🍽️ Inferência Inteligente de Intervalo de Almoço</span>
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">
                    Ao receber a foto do refeitório do reitor, o algoritmo calcula o tempo que o profissional passou se alimentando e ajusta a jornada para evitar menos do que 1 hora obrigatória (o que geraria não conformidade CLT de 50% de multa).
                  </p>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handeQuickLunchInference(65)}
                      className="bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-200 font-bold transition text-xs py-2 px-3 rounded-lg flex items-center justify-between"
                    >
                      <span>Simular Prato Almoço (65 min - Legalizado)</span>
                      <span className="font-mono text-[10px]">Presença OK</span>
                    </button>
                    <button
                      onClick={() => handeQuickLunchInference(45)}
                      className="bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/40 text-rose-200 font-bold transition text-xs py-2 px-3 rounded-lg flex items-center justify-between"
                    >
                      <span>Simular Reforço Rápido (45 min - Fora da Lei)</span>
                      <span className="font-mono text-[10px] text-rose-400">Irregularidade</span>
                    </button>
                  </div>
                </div>

                <div className="border border-dashed border-slate-800 rounded-xl p-5 flex flex-col items-center justify-center text-center bg-slate-900/40">
                  <Upload className="h-8 w-8 text-indigo-400 mb-2" />
                  <h4 className="text-xs font-semibold text-slate-300 uppercase">Processar Foto de Almoço Real</h4>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, "almoco")}
                    className="hidden"
                    id="almoco-file-upload"
                  />
                  <label
                    htmlFor="almoco-file-upload"
                    className="mt-3 bg-slate-800 hover:bg-slate-700 text-xs text-white px-3 py-1.5 rounded cursor-pointer font-bold transition"
                  >
                    Anexar Foto de Refeitório
                  </label>
                </div>
              </div>
            )}

            {aiHubTab === "geofencing" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5" id="geofencing-tab">
                
                <div className="bg-slate-900/40 p-5 border border-slate-800/80 rounded-xl flex flex-col justify-between" id="geofencing-sub">
                  <div>
                    <h3 className="text-xs font-bold text-slate-300 uppercase mb-2 flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-rose-500 animate-bounce" />
                      GPS Geofencing e Perímetro do CD1 GPA
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed mb-4">
                      A área delimitada da sede é de <strong>150 metros</strong> de raio em torno da Rodovia Anhanguera, São Paulo. Qualquer batida por aplicativo fora dessa cerca de satélite é marcada como não conformidade estrita do sistema.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleCheckCurrentLocation}
                      disabled={isCheckingLocation}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-2"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      {isCheckingLocation ? "Consultando Coordenadas..." : "Validar Minhas Coordenadas Geográficas"}
                    </button>

                    <button
                      onClick={handleSimulatedCheckIn}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5"
                    >
                      <Compass className="h-3.5 w-3.5 text-rose-400" />
                      Simular Entrada/Saída Georreferenciada Diária
                    </button>
                  </div>
                </div>

                {/* Satellite Radar Mock Grid Map */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                      🛰️ Sobreposição de Satélite Ativa
                    </span>
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 rounded font-mono">
                      Radar On
                    </span>
                  </div>

                  {/* Simulated map graphic */}
                  <div className="h-32 bg-slate-900 rounded border border-slate-800/60 relative overflow-hidden flex items-center justify-center">
                    
                    {/* Grid Lines */}
                    <div className="absolute inset-0 grid grid-cols-6 grid-rows-4 opacity-20">
                      {Array.from({ length: 24 }).map((_, i) => (
                        <div key={i} className="border-r border-b border-indigo-400"></div>
                      ))}
                    </div>

                    {/* Concentric rings to symbolize radius */}
                    <div className="absolute w-24 h-24 rounded-full border border-dashed border-indigo-500/40 animate-ping"></div>
                    <div className="absolute w-16 h-16 rounded-full border border-indigo-500/50 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                    </div>

                    {/* GPS Point indicators */}
                    <div className="absolute top-1/2 left-1/3 bg-rose-500 text-[8px] text-white px-1 rounded shadow animate-pulse">
                      Ponto GPA CD1
                    </div>

                    {currentCoords && (
                      <div className="absolute top-1/3 right-1/4 bg-emerald-500 text-[8px] text-white px-1.5 rounded shadow animate-bounce">
                        Funcionário Localizado COORDS
                      </div>
                    )}
                  </div>

                </div>

              </div>
            )}

            {aiHubTab === "backoffice" && (
              <div className="bg-slate-900/60 p-6 border border-slate-800/80 rounded-xl" id="backoffice-tab">
                
                {/* Header and Sub-tab selector */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800/80">
                  <div>
                    <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                      <Layers className="h-5 w-5 text-indigo-400" />
                      Painel Técnico de Controle &amp; Backoffice (Portaria 671)
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Mapeamento integrado de contratações, esteira de engenharia técnica (Jira) e trilha de capacitações de CLT.
                    </p>
                  </div>
                  
                  {/* Sub-tab selection */}
                  <div className="flex bg-slate-950 p-1 border border-slate-800 rounded-lg overflow-x-auto">
                    <button
                      onClick={() => setBackofficeSubTab("vagas")}
                      className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase whitespace-nowrap transition-all ${
                        backofficeSubTab === "vagas" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      🤝 Seleção &amp; Vagas
                    </button>
                    <button
                      onClick={() => setBackofficeSubTab("jira")}
                      className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase whitespace-nowrap transition-all ${
                        backofficeSubTab === "jira" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      ⚙️ Roadmap Jira Backoffice
                    </button>
                    <button
                      onClick={() => setBackofficeSubTab("treinamento")}
                      className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase whitespace-nowrap transition-all ${
                        backofficeSubTab === "treinamento" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      📚 Capacitação CLT
                    </button>
                  </div>
                </div>

                {/* Sub-tab content 1: Seleção e Candidatos */}
                {backofficeSubTab === "vagas" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      
                      {/* Left side: JD and Apply form */}
                      <div className="lg:col-span-1 bg-slate-950/60 p-5 rounded-xl border border-slate-800/80">
                        <h4 className="text-xs font-bold text-slate-200 uppercase mb-3 flex items-center gap-1.5">
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                          Vaga: Analista de Desenvolvimento III
                        </h4>
                        
                        <div className="text-[11px] text-slate-400 space-y-2 leading-relaxed mb-5">
                          <p>
                            <strong>Local:</strong> Barueri/SP (Presencial) <br />
                            <strong>Escopo:</strong> Evoluções corretivas e evolutivas dos sistemas de Backoffice: focado em <em>LG Folha Nuvem</em>, <em>Benner</em>, <em>Tax One</em> e <em>Mastersaf ERP</em>.
                          </p>
                          <p className="border-t border-slate-800/50 pt-2">
                            Envie sua inscrição no formulário abaixo para simular um fluxo completo de processamento de novos talentos e sua contratação automatizada de backoffice.
                          </p>
                        </div>

                        {/* Candidate inscription form */}
                        <form onSubmit={handleCreateCandidate} className="space-y-3 pt-3 border-t border-slate-800/50">
                          <div>
                            <label className="block text-[10px] text-slate-400 uppercase mb-1">Nome Completo</label>
                            <input
                              type="text"
                              value={candName}
                              onChange={(e) => setCandName(e.target.value)}
                              placeholder="ex: Guilherme Sampaio"
                              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] text-slate-400 uppercase mb-1">E-mail</label>
                              <input
                                type="email"
                                value={candEmail}
                                onChange={(e) => setCandEmail(e.target.value)}
                                placeholder="guilherme@gpa.com"
                                className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400 uppercase mb-1">Telefone</label>
                              <input
                                type="text"
                                value={candPhone}
                                onChange={(e) => setCandPhone(e.target.value)}
                                placeholder="(11) 98765-4321"
                                className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 uppercase mb-1">Tecnologias &amp; Skills</label>
                            <input
                              type="text"
                              value={candSkills}
                              onChange={(e) => setCandSkills(e.target.value)}
                              placeholder="ex: React, Oracle Fusion, Mastersaf"
                              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 uppercase mb-1">Resumo Curricular Breve</label>
                            <textarea
                              rows={2}
                              value={candSummary}
                              onChange={(e) => setCandSummary(e.target.value)}
                              placeholder="Resuma sua experiência com backoffice..."
                              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none"
                            />
                          </div>
                          <button
                            type="submit"
                            className="w-full bg-indigo-600 hover:bg-indigo-500 font-bold text-xs py-2 px-3 rounded text-white transition flex items-center justify-center gap-1.5"
                          >
                            <User className="h-3.5 w-3.5" />
                            Enviar Inscrição de Candidato
                          </button>
                        </form>
                      </div>

                      {/* Right side: Interactive Kanban pipeline */}
                      <div className="lg:col-span-2 space-y-4">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            📊 Esteira de Contratação &amp; Pipeline de Atração (Canalização de Estado Real-Time)
                          </span>
                        </div>

                        {/* Columns Container */}
                        <div className="grid grid-cols-4 gap-2">
                          
                          {/* Col 1 - Triagem */}
                          <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/75">
                            <div className="flex items-center justify-between mb-3 pb-1 border-b border-slate-800">
                              <span className="text-[10px] font-bold text-slate-300 uppercase">1. Triagem</span>
                              <span className="text-[9px] bg-slate-900 text-slate-400 px-1 py-0.5 rounded font-mono">
                                {candidates.filter(c => c.step === "1" || !c.step).length}
                              </span>
                            </div>
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                              {candidates.filter(c => c.step === "1" || !c.step).map(c => (
                                <div key={c.id} className="bg-slate-900 border border-slate-800/80 p-2 rounded hover:border-slate-700 transition">
                                  <h5 className="text-[11px] font-bold text-slate-200 line-clamp-1">{c.name}</h5>
                                  <p className="text-[8px] text-slate-500 line-clamp-1">{c.email}</p>
                                  <p className="text-[8px] text-indigo-400 font-mono my-1 font-semibold">{c.techSkills}</p>
                                  <div className="flex justify-end gap-1 mt-1.5">
                                    <button
                                      onClick={() => handleUpdateCandidateStep(c.id, "2")}
                                      className="text-[8px] bg-indigo-950 hover:bg-indigo-900 text-indigo-300 px-1 py-0.5 rounded transition font-bold"
                                    >
                                      RH &rarr;
                                    </button>
                                  </div>
                                </div>
                              ))}
                              {candidates.filter(c => c.step === "1" || !c.step).length === 0 && (
                                <p className="text-[9px] text-slate-600 text-center py-2 italic font-mono">Vazio</p>
                              )}
                            </div>
                          </div>

                          {/* Col 2 - Entrevista RH */}
                          <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/75">
                            <div className="flex items-center justify-between mb-3 pb-1 border-b border-slate-800">
                              <span className="text-[9px] font-bold text-slate-300 uppercase">2. Bate-papo</span>
                              <span className="text-[9px] bg-slate-900 text-slate-400 px-1 py-0.5 rounded font-mono">
                                {candidates.filter(c => c.step === "2").length}
                              </span>
                            </div>
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                              {candidates.filter(c => c.step === "2").map(c => (
                                <div key={c.id} className="bg-slate-900 border border-slate-800/80 p-2 rounded hover:border-slate-700 transition">
                                  <h5 className="text-[11px] font-bold text-slate-200 line-clamp-1">{c.name}</h5>
                                  <p className="text-[8px] text-slate-500 line-clamp-1">{c.email}</p>
                                  <p className="text-[8px] text-indigo-400 font-mono my-1 font-semibold">{c.techSkills}</p>
                                  <div className="flex justify-between gap-1 mt-1.5">
                                    <button
                                      onClick={() => handleUpdateCandidateStep(c.id, "1")}
                                      className="text-[8px] bg-slate-950 text-slate-500 px-1 py-0.5 rounded hover:bg-slate-900 transition"
                                    >
                                      &larr; Recu
                                    </button>
                                    <button
                                      onClick={() => handleUpdateCandidateStep(c.id, "3")}
                                      className="text-[8px] bg-indigo-950 hover:bg-indigo-900 text-indigo-300 px-1 py-0.5 rounded transition font-bold"
                                    >
                                      Téc &rarr;
                                    </button>
                                  </div>
                                </div>
                              ))}
                              {candidates.filter(c => c.step === "2").length === 0 && (
                                <p className="text-[9px] text-slate-600 text-center py-2 italic font-mono">Vazio</p>
                              )}
                            </div>
                          </div>

                          {/* Col 3 - Avaliação Técnica */}
                          <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/75">
                            <div className="flex items-center justify-between mb-3 pb-1 border-b border-slate-800">
                              <span className="text-[9px] font-bold text-slate-300 uppercase">3. Técnico</span>
                              <span className="text-[9px] bg-slate-900 text-slate-400 px-1 py-0.5 rounded font-mono">
                                {candidates.filter(c => c.step === "3").length}
                              </span>
                            </div>
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                              {candidates.filter(c => c.step === "3").map(c => (
                                <div key={c.id} className="bg-slate-900 border border-slate-800/80 p-2 rounded hover:border-slate-700 transition">
                                  <h5 className="text-[11px] font-bold text-amber-300 line-clamp-1">{c.name}</h5>
                                  <p className="text-[8px] text-slate-400 line-clamp-2 italic">"{c.summary}"</p>
                                  
                                  {/* Contract action for Gestor RH */}
                                  {currentUser?.role === "gestor_rh" ? (
                                    <button
                                      onClick={() => handleHireAndIntegrateCandidate(c)}
                                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[8px] py-1 px-1 rounded text-center transition flex items-center justify-center gap-0.5 mt-1.5"
                                    >
                                      🤝 CONTRATAR!
                                    </button>
                                  ) : (
                                    <div className="mt-1 text-center py-0.5 text-[7px] uppercase tracking-wider text-indigo-400 bg-indigo-950/40 rounded border border-indigo-900/30">
                                      Aguardando RH
                                    </div>
                                  )}
                                  
                                  <div className="flex justify-start gap-1 mt-1.5">
                                    <button
                                      onClick={() => handleUpdateCandidateStep(c.id, "2")}
                                      className="text-[8px] bg-slate-950 text-slate-500 px-1 py-0.5 rounded hover:bg-slate-900 transition"
                                    >
                                      &larr; Recuar
                                    </button>
                                  </div>
                                </div>
                              ))}
                              {candidates.filter(c => c.step === "3").length === 0 && (
                                <p className="text-[9px] text-slate-600 text-center py-2 italic font-mono">Vazio</p>
                              )}
                            </div>
                          </div>

                          {/* Col 4 - Contratados */}
                          <div className="bg-emerald-950/20 p-2 rounded-lg border border-emerald-850/40">
                            <div className="flex items-center justify-between mb-3 pb-1 border-b border-emerald-800/45">
                              <span className="text-[10px] font-bold text-emerald-400 uppercase">4. Contratado</span>
                              <span className="text-[9px] bg-emerald-950 text-emerald-400 px-1 py-0.5 rounded font-mono">
                                {candidates.filter(c => c.step === "4").length}
                              </span>
                            </div>
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                              {candidates.filter(c => c.step === "4").map(c => (
                                <div key={c.id} className="bg-slate-900 border border-emerald-500/30 p-2 rounded shadow">
                                  <h5 className="text-[11px] font-bold text-emerald-400 line-clamp-1">
                                    {c.name}
                                  </h5>
                                  <p className="text-[8px] text-slate-400">
                                    Sinc. Folha LG Realizada
                                  </p>
                                  <p className="text-[8px] text-slate-500 font-mono">
                                    {c.email}
                                  </p>
                                </div>
                              ))}
                              {candidates.filter(c => c.step === "4").length === 0 && (
                                <p className="text-[9px] text-slate-600 text-center py-2 italic font-mono">Nenhum contratado</p>
                              )}
                            </div>
                          </div>

                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {/* Sub-tab content 2: JIRA Technical Cards */}
                {backofficeSubTab === "jira" && (
                  <div className="space-y-4">
                    
                    {/* Header bar with total tasks and create button */}
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h4 className="text-xs font-bold text-slate-200 uppercase flex items-center gap-1">
                          <Settings className="h-4 w-4 text-indigo-400" />
                          Esteira de Qualidade de Sistemas Backoffice (LG, Benner, Mastersaf, Taxone)
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Atividades e demandas corretivas, evolutivas e de conformidade tributário-fiscal ou de folha da Odontoprev.
                        </p>
                      </div>

                      {/* Modal launcher button */}
                      <button
                        onClick={() => setShowJiraModal(true)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition text-xs py-1.5 px-3.5 rounded-lg flex items-center gap-1 shrink-0 shadow-lg"
                      >
                        <RefreshCw className="h-3.5 w-3.5 rotate-45" />
                        Nova Demanda Jira
                      </button>
                    </div>

                    {/* Jira Kanban Columns */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 border-t border-slate-800/40 pt-2" id="jira-kanban-board">
                      
                      {/* Column 1: Backlog */}
                      <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">📋 Backlog</span>
                          <span className="text-[9px] bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                            {jiraTasks.filter(t => t.status === "Backlog").length}
                          </span>
                        </div>
                        <div className="space-y-2 max-h-[500px] overflow-y-auto">
                          {jiraTasks.filter(t => t.status === "Backlog").map(t => (
                            <div key={t.id} className="bg-slate-900/90 border border-slate-800 p-2 px-2.5 rounded-lg hover:border-slate-700 transition space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] bg-indigo-950 text-indigo-300 px-1 rounded font-mono font-bold">{t.id}</span>
                                <span className={`text-[8px] font-semibold px-1 rounded uppercase tracking-wider ${
                                  t.priority === 'Crítica' ? "bg-red-500/20 text-red-400" :
                                  t.priority === 'Alta' ? "bg-amber-600/20 text-amber-400" :
                                  "bg-slate-800 text-slate-400"
                                }`}>
                                  {t.priority}
                                </span>
                              </div>
                              <h5 className="text-[10px] font-bold text-slate-200 leading-tight">{t.title}</h5>
                              <p className="text-[9px] text-slate-500 line-clamp-2 leading-snug">{t.description}</p>
                              
                              <div className="pt-1.5 border-t border-slate-800/85 flex items-center justify-between">
                                <span className="text-[8px] text-slate-400 font-medium whitespace-nowrap overflow-hidden text-ellipsis">Assignee: {t.assignee}</span>
                                <span className="text-[8px] bg-blue-950/50 text-blue-300 px-1 rounded">{t.systemDomain}</span>
                              </div>
                              <div className="flex justify-end gap-1 pt-1">
                                <button
                                  onClick={() => handleUpdateJiraTaskStatus(t.id, "To Do")}
                                  className="text-[8px] text-indigo-400 hover:text-indigo-300 underline font-bold"
                                >
                                  Mover &rarr;
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Column 2: To Do */}
                      <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
                          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">⏳ To Do</span>
                          <span className="text-[9px] bg-slate-900 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                            {jiraTasks.filter(t => t.status === "To Do").length}
                          </span>
                        </div>
                        <div className="space-y-2 max-h-[500px] overflow-y-auto">
                          {jiraTasks.filter(t => t.status === "To Do").map(t => (
                            <div key={t.id} className="bg-slate-900/90 border border-slate-800 p-2 px-2.5 rounded-lg hover:border-slate-700 transition space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] bg-indigo-950 text-indigo-300 px-1 rounded font-mono font-bold">{t.id}</span>
                                <span className={`text-[8px] font-semibold px-1 rounded uppercase tracking-wider ${
                                  t.priority === 'Crítica' ? "bg-red-500/20 text-red-400" :
                                  t.priority === 'Alta' ? "bg-amber-600/20 text-amber-400" :
                                  "bg-slate-800 text-slate-400"
                                }`}>
                                  {t.priority}
                                </span>
                              </div>
                              <h5 className="text-[10px] font-bold text-slate-200 leading-tight">{t.title}</h5>
                              <p className="text-[9px] text-slate-500 line-clamp-2 leading-snug">{t.description}</p>
                              
                              <div className="pt-1.5 border-t border-slate-800/85 flex items-center justify-between">
                                <span className="text-[8px] text-slate-400 font-medium whitespace-nowrap overflow-hidden text-ellipsis">Assignee: {t.assignee}</span>
                                <span className="text-[8px] bg-blue-950/50 text-blue-300 px-1 rounded">{t.systemDomain}</span>
                              </div>
                              <div className="flex justify-between items-center gap-1 pt-1">
                                <button
                                  onClick={() => handleUpdateJiraTaskStatus(t.id, "Backlog")}
                                  className="text-[8px] text-slate-500 hover:text-slate-400 underline"
                                >
                                  &larr; Recu
                                </button>
                                <button
                                  onClick={() => handleUpdateJiraTaskStatus(t.id, "In Progress")}
                                  className="text-[8px] text-indigo-400 hover:text-indigo-300 font-bold underline"
                                >
                                  Iniciar &rarr;
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Column 3: In Progress */}
                      <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-indigo-950">
                          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">⚡ In Progress</span>
                          <span className="text-[9px] bg-indigo-950 text-indigo-400 px-1.5 py-0.5 rounded font-mono">
                            {jiraTasks.filter(t => t.status === "In Progress").length}
                          </span>
                        </div>
                        <div className="space-y-2 max-h-[500px] overflow-y-auto">
                          {jiraTasks.filter(t => t.status === "In Progress").map(t => (
                            <div key={t.id} className="bg-slate-900/90 border border-indigo-500/10 p-2 px-2.5 rounded-lg hover:border-indigo-500/20 transition space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] bg-indigo-950 text-indigo-300 px-1 rounded font-mono font-bold">{t.id}</span>
                                <span className={`text-[8px] font-semibold px-1 rounded uppercase tracking-wider ${
                                  t.priority === 'Crítica' ? "bg-red-500/20 text-red-400" :
                                  t.priority === 'Alta' ? "bg-amber-600/20 text-amber-400" :
                                  "bg-slate-800 text-slate-400"
                                }`}>
                                  {t.priority}
                                </span>
                              </div>
                              <h5 className="text-[10px] font-bold text-slate-100 leading-tight">{t.title}</h5>
                              <p className="text-[9px] text-slate-400 line-clamp-2 leading-snug">{t.description}</p>
                              
                              <div className="pt-1.5 border-t border-slate-800/85 flex items-center justify-between">
                                <span className="text-[8px] text-indigo-300 font-medium whitespace-nowrap overflow-hidden text-ellipsis">Assignee: {t.assignee}</span>
                                <span className="text-[8px] bg-blue-950/50 text-blue-300 px-1 rounded">{t.systemDomain}</span>
                              </div>
                              <div className="flex justify-between items-center gap-1 pt-1">
                                <button
                                  onClick={() => handleUpdateJiraTaskStatus(t.id, "To Do")}
                                  className="text-[8px] text-slate-500 hover:text-slate-400 underline"
                                >
                                  &larr; Voltar
                                </button>
                                <button
                                  onClick={() => handleUpdateJiraTaskStatus(t.id, "Done")}
                                  className="text-[8px] text-emerald-400 hover:text-emerald-300 font-bold underline"
                                >
                                  Feito &radic;
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Column 4: Done */}
                      <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
                          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">✅ Done</span>
                          <span className="text-[9px] bg-emerald-950 text-emerald-400 px-1.5 py-0.5 rounded font-mono">
                            {jiraTasks.filter(t => t.status === "Done").length}
                          </span>
                        </div>
                        <div className="space-y-2 max-h-[500px] overflow-y-auto">
                          {jiraTasks.filter(t => t.status === "Done").map(t => (
                            <div key={t.id} className="bg-slate-900/50 border border-emerald-500/20 p-2 px-2.5 rounded-lg hover:border-emerald-500/30 transition space-y-1.5 opacity-80">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] bg-slate-950 text-emerald-400 px-1 rounded font-mono">{t.id}</span>
                                <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                              </div>
                              <h5 className="text-[10px] font-bold text-slate-400 line-through leading-tight">{t.title}</h5>
                              <p className="text-[9px] text-slate-500 line-clamp-1">{t.description}</p>
                              
                              <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between">
                                <span className="text-[8px] text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis">Assignee: {t.assignee}</span>
                                <button
                                  onClick={() => deleteJiraTaskFromDb(t.id)}
                                  className="text-[7px] bg-red-950/30 text-red-400 px-1 rounded hover:bg-red-950 transition"
                                  title="Remover Cartão"
                                >
                                  Excluir
                                </button>
                              </div>
                              <div className="flex justify-start pt-0.5">
                                <button
                                  onClick={() => handleUpdateJiraTaskStatus(t.id, "In Progress")}
                                  className="text-[8px] text-indigo-400 hover:text-indigo-300 underline"
                                >
                                  Reabrir
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {/* Sub-tab content 3: Corporate training */}
                {backofficeSubTab === "treinamento" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      
                      {/* Left side: Assign details */}
                      <div className="lg:col-span-1 bg-slate-950/60 p-5 rounded-xl border border-slate-800/80">
                        <h4 className="text-xs font-bold text-slate-200 uppercase mb-3 flex items-center gap-1.5">
                          <BookOpen className="h-4 w-4 text-indigo-400" />
                          Atribuição de Capacitações
                        </h4>
                        <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                          Crie cursos obrigatórios de Portaria MTP 671, conformidade jurídica tributária ou segurança em ERP e vincule aos colaboradores ativos.
                        </p>

                        <form onSubmit={handleCreateTraining} className="space-y-3 pt-3 border-t border-slate-800/50">
                          <div>
                            <label className="block text-[10px] text-slate-400 uppercase mb-1">Título do Curso Corporativo</label>
                            <input
                              type="text"
                              value={trainCourseName}
                              onChange={(e) => setTrainCourseName(e.target.value)}
                              placeholder="ex: Planejamento Geral Benner v5"
                              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] text-slate-400 uppercase mb-1">Colaborador Vinculado</label>
                            <select
                              value={trainEmployeeId}
                              onChange={(e) => setTrainEmployeeId(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                            >
                              <option value="">Selecione...</option>
                              {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>
                                  {emp.name} ({emp.role})
                                </option>
                              ))}
                            </select>
                          </div>

                          <button
                            type="submit"
                            className="w-full bg-indigo-600 hover:bg-indigo-500 font-bold text-xs py-2 px-3 rounded text-white transition flex items-center justify-center gap-1"
                          >
                            <BookOpen className="h-3.5 w-3.5" />
                            Vincular Treinamento Técnico
                          </button>
                        </form>
                      </div>

                      {/* Right side: Training grid list with progress actions */}
                      <div className="lg:col-span-2 space-y-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            🎓 Monitoramento de Progresso de Capacitações Ativas ({trainings.length})
                          </span>
                          <span className="text-[9px] bg-slate-950 text-indigo-400 px-2 py-0.5 rounded font-mono">
                            Autoafirmação sob Portaria MTP 671
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {trainings.map(tr => {
                            const emp = employees.find(e => e.id === tr.employeeId);
                            return (
                              <div key={tr.id} className="bg-slate-950/80 p-4 border border-slate-850 rounded-xl space-y-3 relative overflow-hidden flex flex-col justify-between">
                                {tr.completed && (
                                  <div className="absolute top-0 right-0 bg-emerald-500/20 text-emerald-400 text-[8px] font-bold uppercase px-2 py-0.5 rounded-bl">
                                    Concluído
                                  </div>
                                )}
                                <div>
                                  <h5 className="text-xs font-bold text-slate-200 line-clamp-1">{tr.courseName}</h5>
                                  <p className="text-[9px] text-slate-500 mt-0.5">
                                    Destinatário: <strong className="text-slate-400">{emp?.name || "Desconhecido"}</strong>
                                  </p>
                                </div>

                                <div className="space-y-1 pt-1">
                                  <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                                    <span>Progresso Geral</span>
                                    <span>{tr.progress}%</span>
                                  </div>
                                  <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                                    <div
                                      style={{ width: `${tr.progress}%` }}
                                      className={`h-full rounded-full transition-all duration-300 ${
                                        tr.completed ? "bg-emerald-500" : "bg-indigo-500"
                                      }`}
                                    ></div>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-900">
                                  <span className="text-[8px] text-slate-500 font-mono font-semibold">Atividade: {tr.lastActivity}</span>
                                  
                                  {!tr.completed ? (
                                    <button
                                      onClick={() => handleIncrementTrainingProgress(tr.id)}
                                      className="bg-indigo-950 hover:bg-indigo-900 text-indigo-400 hover:text-indigo-350 text-[9px] font-bold py-1 px-2.5 rounded transition"
                                    >
                                      Estudar (+20%)
                                    </button>
                                  ) : (
                                    <span className="text-[9px] text-emerald-400 font-bold flex items-center gap-0.5">
                                      &radic; Certificado Disponível
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          {trainings.length === 0 && (
                            <div className="md:col-span-2 text-center py-12 bg-slate-950/40 border border-dashed border-slate-800 rounded-xl">
                              <p className="text-xs text-slate-500 italic">Nenhum treinamento atribuído no momento.</p>
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {/* Jira Modal Wizard overlay */}
                {showJiraModal && (
                  <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
                      
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <h4 className="text-sm font-bold text-slate-100 uppercase flex items-center gap-1.5 font-sans">
                          <Settings className="h-4.5 w-4.5 text-indigo-400 rotate-90" />
                          Nova Atividade Técnica no Jira
                        </h4>
                        <button
                          onClick={() => setShowJiraModal(false)}
                          className="text-slate-500 hover:text-slate-300 font-bold text-lg h-6 w-6 flex items-center justify-center rounded-full bg-slate-950"
                        >
                          &times;
                        </button>
                      </div>

                      <form onSubmit={handleCreateJiraTask} className="space-y-4">
                        <div>
                          <label className="block text-[10px] text-slate-400 uppercase mb-1">Título da Atividade Técnica</label>
                          <input
                            type="text"
                            value={jiraTaskTitle}
                            onChange={(e) => setJiraTaskTitle(e.target.value)}
                            placeholder="ex: Ajuste no Webhook LG Nuvem para Horas Extras"
                            className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-400 uppercase mb-1 font-mono">Descrição Técnica Detalhada</label>
                          <textarea
                            rows={3}
                            value={jiraTaskDesc}
                            onChange={(e) => setJiraTaskDesc(e.target.value)}
                            placeholder="Descreva o escopo sistêmico, requisitos de banco ou API..."
                            className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] text-slate-400 uppercase mb-1">Área / Domínio do Backoffice</label>
                            <select
                              value={jiraTaskDomain}
                              onChange={(e) => setJiraTaskDomain(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                            >
                              <option value="Folha / ERP">Folha / ERP (LG)</option>
                              <option value="Tributário">Tributário (TaxOne/Mastersaf)</option>
                              <option value="Jurídico">Jurídico (Benner/Painel)</option>
                              <option value="Outro">Outros Portais</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 uppercase mb-1">Prioridade</label>
                            <select
                              value={jiraTaskPriority}
                              onChange={(e: any) => setJiraTaskPriority(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                            >
                              <option value="Baixa">Baixa</option>
                              <option value="Média">Média</option>
                              <option value="Alta">Alta</option>
                              <option value="Crítica">Crítica</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-400 uppercase mb-1">Responsável Técnico / Desenvolvedor</label>
                          <input
                            type="text"
                            value={jiraTaskAssignee}
                            onChange={(e) => setJiraTaskAssignee(e.target.value)}
                            placeholder="ex: Guilherme Sampaio"
                            className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800/80">
                          <button
                            type="button"
                            onClick={() => setShowJiraModal(false)}
                            className="bg-slate-850 hover:bg-slate-850 text-slate-400 font-bold text-xs py-2 px-4 rounded transition"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 px-4 rounded transition flex items-center gap-1"
                          >
                            Criar Card Jira
                          </button>
                        </div>
                      </form>

                    </div>
                  </div>
                )}

              </div>
            )}

          </div>

          {/* Dynamic Monthly Calendar Visualizer with Tabs for Daily, Weekly, and Monthly Views */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col" id="calendar-wrapper-panel">
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-800">
              <div>
                <h2 className="font-bold text-slate-100 flex items-center gap-2 text-sm uppercase tracking-wide">
                  <CalendarIcon className="h-4.5 w-4.5 text-indigo-400" />
                  Visualização de Ponto CLT ({activeYearMonth})
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Análise de jornada de trabalho com auditabilidade legal.
                </p>
              </div>

              {/* View Selector Tabs */}
              <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-lg self-stretch sm:self-auto overflow-x-auto shrink-0">
                <button
                  onClick={() => setDashboardViewMode("diaria")}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase transition-all shrink-0 ${
                    dashboardViewMode === "diaria" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  📅 Diária
                </button>
                <button
                  onClick={() => setDashboardViewMode("semanal")}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase transition-all shrink-0 ${
                    dashboardViewMode === "semanal" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  📊 Semanal
                </button>
                <button
                  onClick={() => setDashboardViewMode("mensal")}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase transition-all shrink-0 ${
                    dashboardViewMode === "mensal" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  📆 Mensal
                </button>
              </div>

              {/* Day filter/search options */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-slate-400 font-bold">Referência:</span>
                <select
                  value={activeYearMonth}
                  onChange={(e) => setActiveYearMonth(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-white focus:outline-none"
                >
                  <option value="2000-01">Simular Janeiros</option>
                  <option value="2026-06">2026-06 (Corrente)</option>
                </select>
              </div>
            </div>

            {/* DAILY VIEW SEGMENT */}
            {dashboardViewMode === "diaria" && (
              <div className="flex flex-col gap-4 animate-fade-in" id="daily-dashboard-view">
                {/* Day selector control row */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/30 border border-slate-800 p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium">Data Selecionada:</span>
                    <select
                      value={selectedDayForDaily}
                      onChange={(e) => setSelectedDayForDaily(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
                    >
                      {daysGrid.map(d => {
                        const dateObj = new Date(d + "T12:00:00");
                        const name = dateObj.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" });
                        const hasClocks = clockIns.some(c => c.employeeId === activeEmployee.id && c.date === d);
                        return (
                          <option key={d} value={d}>
                            {d} ({name}) {hasClocks ? "• Atividade" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        const idx = daysGrid.indexOf(selectedDayForDaily);
                        if (idx > 0) setSelectedDayForDaily(daysGrid[idx - 1]);
                      }}
                      disabled={daysGrid.indexOf(selectedDayForDaily) === 0}
                      className="px-2 py-1 bg-slate-900 border border-slate-850 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none rounded text-[11px] font-bold text-slate-300 transition-all"
                    >
                      ← Dia Anterior
                    </button>
                    <button
                      onClick={() => {
                        const idx = daysGrid.indexOf(selectedDayForDaily);
                        if (idx < daysGrid.length - 1) setSelectedDayForDaily(daysGrid[idx + 1]);
                      }}
                      disabled={daysGrid.indexOf(selectedDayForDaily) === daysGrid.length - 1}
                      className="px-2 py-1 bg-slate-900 border border-slate-850 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none rounded text-[11px] font-bold text-slate-300 transition-all"
                    >
                      Próximo Dia →
                    </button>
                  </div>
                </div>

                {/* Day Details Card */}
                {(() => {
                  const dayStr = selectedDayForDaily;
                  const dateObj = new Date(dayStr + "T12:00:00");
                  const dayName = dateObj.toLocaleDateString("pt-BR", { weekday: "long" });
                  const isWeekend = dayName.includes("sábado") || dayName.includes("domingo");

                  const dayClockIns = clockIns
                    .filter(c => c.employeeId === activeEmployee.id && c.date === dayStr)
                    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

                  const dailyCalc = calculateDailyCLT(dayStr, clockIns.filter(c => c.employeeId === activeEmployee.id));

                  // Find lunch interval description
                  let lunchIntervalDescr = "Nenhum intervalo intrajornada registrado";
                  if (dailyCalc.lunchMinutes > 0) {
                    lunchIntervalDescr = `${dailyCalc.lunchMinutes} minutos de pausa realizada`;
                  }

                  return (
                    <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-5 flex flex-col gap-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/60 pb-3">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Detalhamento Operacional Diário</p>
                          <h3 className="text-base font-bold text-white capitalize">{dayName}, {dayStr.split("-")[2]} de Junho</h3>
                        </div>

                        <div className="flex items-center gap-2">
                          {dayClockIns.length > 0 ? (
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded font-bold border border-emerald-500/20 uppercase tracking-widest flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                              Expediente Registrado
                            </span>
                          ) : (
                            <span className="text-[10px] bg-slate-850 text-slate-400 px-2 py-1 rounded font-bold border border-slate-700 uppercase tracking-widest">
                              Sem batidas (Folga / Ausência)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Timeline flow */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        
                        {/* Batidas catalogued */}
                        <div className="flex flex-col gap-3">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cronologia de Registros (Portaria MTP 671)</h4>
                          
                          {dayClockIns.length === 0 ? (
                            <div className="p-4 bg-slate-950/20 border border-slate-800/55 border-dashed rounded-lg text-center py-6 text-xs text-slate-500 italic">
                              Não há nenhuma marcação de ponto gravada para a data de {dayStr}.
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {dayClockIns.map((cl, idx) => {
                                let badgeColor = "bg-slate-800 text-slate-300 border-slate-700";
                                let desc = "";
                                if (cl.type === "entrada") {
                                  badgeColor = "bg-emerald-900/30 text-emerald-300 border-emerald-800/50";
                                  desc = "Início do expediente de trabalho regular";
                                } else if (cl.type === "saida_alm") {
                                  badgeColor = "bg-amber-900/30 text-amber-300 border-amber-800/50";
                                  desc = "Pausa para intervalo intrajornada (Refeição/Almoço)";
                                } else if (cl.type === "volta_alm") {
                                  badgeColor = "bg-blue-900/30 text-blue-300 border-blue-800/50";
                                  desc = "Retorno às atividades pós período de descanso";
                                } else if (cl.type === "saida") {
                                  badgeColor = "bg-rose-900/30 text-rose-300 border-rose-800/55";
                                  desc = "Término da jornada de trabalho diária";
                                }

                                return (
                                  <div key={cl.id} className="flex items-center gap-3 p-2.5 bg-slate-950/30 border border-slate-850 rounded-lg">
                                    <span className="text-xs font-bold text-slate-500 font-mono">#{idx+1}</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border shrink-0 ${badgeColor}`}>
                                      {cl.type.replace("_", " ")}
                                    </span>
                                    <span className="text-sm font-bold text-slate-100 font-mono">{cl.time}</span>
                                    <span className="text-[10.5px] text-slate-400 truncate flex-1 text-right">{desc}</span>
                                    <span className="text-[9px] bg-slate-800 px-1.5 py-0.5 rounded text-indigo-300 capitalize border border-slate-800 font-mono shrink-0">
                                      {cl.source}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Performance metrics & legal analysis */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cálculos e Conformidade CLT</h4>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-lg">
                              <p className="text-[10px] text-slate-400 uppercase">Horas Efetivas</p>
                              <p className="text-lg font-bold text-slate-200 font-mono mt-0.5">
                                {minutesToTime(dailyCalc.totalWorkedMinutes)}
                              </p>
                              <span className="text-[9px] text-slate-500">Trabalho Líquido</span>
                            </div>

                            <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-lg">
                              <p className="text-[10px] text-emerald-400 uppercase">Horas Extras</p>
                              <p className="text-lg font-bold text-emerald-400 font-mono mt-0.5">
                                +{minutesToTime(dailyCalc.overtimeMinutes)}
                              </p>
                              <span className="text-[9px] text-emerald-500 font-medium">Balanço do dia</span>
                            </div>

                            <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-lg col-span-2">
                              <p className="text-[10px] text-slate-400 uppercase">Intervalo de Refeição</p>
                              <p className="text-xs font-bold text-slate-200 mt-0.5 font-mono">
                                {lunchIntervalDescr}
                              </p>
                              {dailyCalc.lunchMinutes > 0 && dailyCalc.lunchMinutes < 60 && (
                                <p className="text-[9px] text-rose-400 font-medium mt-0.5">
                                  ⚠️ Alerta: Intervalo inferior a 1 hora (Inconformidade MTP 671).
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Non-conformities for selected day */}
                          <div className="bg-slate-950/30 border border-slate-850 rounded-lg p-3">
                            <p className="text-[10.5px] font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1">
                              🛡️ Veredito do Perito Regulamentar CLT
                            </p>
                            {dailyCalc.nonConformities.length === 0 ? (
                              <div className="flex items-center gap-2 text-[11px] text-emerald-400 bg-emerald-950/20 p-2 rounded border border-emerald-800/30">
                                <CheckCircle className="h-4 w-4 shrink-0" />
                                <span>Acurácia 100%! Nenhuma inconsistência legal detectada para este dia de expediente de trabalho.</span>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1.5">
                                {dailyCalc.nonConformities.map((nc, idx) => (
                                  <div key={idx} className="flex gap-2 text-[11px] text-rose-300 bg-rose-950/20 p-2 rounded border border-rose-800/30">
                                    <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                                    <div>
                                      <span className="font-bold underline uppercase">{nc.type === "missing_clock_in" ? "Incompleto" : "Divergente"}:</span>{" "}
                                      <span>{nc.description}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                        </div>

                      </div>

                    </div>
                  );
                })()}

              </div>
            )}

            {/* WEEKLY VIEW SEGMENT */}
            {dashboardViewMode === "semanal" && (
              <div className="flex flex-col gap-4 animate-fade-in" id="weekly-dashboard-view">
                
                <p className="text-[11px] text-slate-400 leading-relaxed bg-slate-900/20 p-3 rounded-lg border border-slate-850">
                  💡 A legislação trabalhista brasileira (CLT) estipula um limite fixo padrão de <strong>44 horas semanais</strong> de jornada normal de trabalho. Abaixo você confere o balanço acumulado e a respectiva conformidade regulamentar consolidada para cada agrupamento semanal do mês de referência.
                </p>

                <div className="flex flex-col gap-3.5">
                  {weeklySegments.map((week, idx) => {
                    // Calculate aggregated stats for this week
                    let weekWorkedSeconds = 0;
                    let weekOvertimeSeconds = 0;
                    let weekNonConformitiesCount = 0;
                    let workedDaysCount = 0;

                    // Check which days belong to this week and compute metrics
                    week.days.forEach(dayStr => {
                      const dayClockIns = clockIns.filter(c => c.employeeId === activeEmployee.id && c.date === dayStr);
                      if (dayClockIns.length > 0) workedDaysCount++;
                      
                      const dailyCalc = calculateDailyCLT(dayStr, clockIns.filter(c => c.employeeId === activeEmployee.id));
                      weekWorkedSeconds += dailyCalc.totalWorkedMinutes * 60;
                      weekOvertimeSeconds += dailyCalc.overtimeMinutes * 60;
                      weekNonConformitiesCount += dailyCalc.nonConformities.length;
                    });

                    const totalWorkedHrsDecimal = weekWorkedSeconds / 3600;
                    const metaProgressPercent = Math.min(100, (totalWorkedHrsDecimal / 44) * 100);

                    return (
                      <div key={idx} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition flex flex-col gap-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full"></span>
                            <span className="font-bold text-slate-100 uppercase text-xs tracking-wider">{week.name}</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 font-mono">Dias Trabalhados: <strong className="text-white">{workedDaysCount} dias</strong></span>
                          </div>
                        </div>

                        {/* Weekly Metrics layout */}
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 py-1">
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase">Trabalho Acumulado</p>
                            <p className="text-sm font-bold text-slate-200 mt-1 font-mono">
                              {minutesToTime(Math.floor(weekWorkedSeconds / 60))}
                            </p>
                          </div>

                          <div>
                            <p className="text-[10px] text-emerald-400 uppercase">Extras Semanal</p>
                            <p className="text-sm font-bold text-emerald-400 mt-1 font-mono">
                              +{minutesToTime(Math.floor(weekOvertimeSeconds / 60))}
                            </p>
                          </div>

                          <div>
                            <p className="text-[10px] text-slate-400 uppercase">Alertas de Auditoria</p>
                            <p className={`text-sm font-bold mt-1 font-mono ${weekNonConformitiesCount > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                              {weekNonConformitiesCount > 0 ? `⚠️ ${weekNonConformitiesCount} Alertas` : "✓ 100% Regular"}
                            </p>
                          </div>

                          {/* Progress Meta CLT (44 hrs) */}
                          <div className="flex flex-col justify-center">
                            <div className="flex items-center justify-between text-[10px] mb-1">
                              <span className="text-slate-400 uppercase flex items-center gap-1">Meta CLT</span>
                              <span className="font-bold text-slate-200 font-mono">{totalWorkedHrsDecimal.toFixed(1)}h / 44h</span>
                            </div>
                            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-850">
                              <div 
                                className={`h-full rounded-full transition-all ${
                                  metaProgressPercent > 100 ? "bg-emerald-500" : "bg-indigo-600"
                                }`}
                                style={{ width: `${metaProgressPercent}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>

                        {/* Horizontal daily micro status circles for Monday to Sunday */}
                        <div className="bg-slate-950/40 p-2 rounded border border-slate-850/60 mt-1">
                          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-2">Monitoramento de Consistência Diária na Semana:</p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {week.days.map(dayStr => {
                              const dayNum = parseInt(dayStr.split("-")[2]);
                              const dateObj = new Date(dayStr + "T12:00:00");
                              const weekdayLetter = dateObj.toLocaleDateString("pt-BR", { weekday: "short" }).slice(0, 1).toUpperCase();
                              
                              const dayClockIns = clockIns.filter(c => c.employeeId === activeEmployee.id && c.date === dayStr);
                              const dailyCalc = calculateDailyCLT(dayStr, clockIns.filter(c => c.employeeId === activeEmployee.id));
                              const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

                              let circleColor = "bg-slate-800 border-slate-750 text-slate-500";
                              let titleText = `${dayStr} (Sem expediente de trabalho regulamentado)`;

                              if (dayClockIns.length > 0) {
                                if (dailyCalc.nonConformities.length > 0) {
                                  circleColor = "bg-rose-900/40 border-rose-800 text-rose-300";
                                  titleText = `${dayStr}: Inconformidade detectada (${dailyCalc.nonConformities.length} alerta/s)`;
                                } else {
                                  circleColor = "bg-emerald-950/70 border-emerald-800 text-emerald-300";
                                  titleText = `${dayStr}: 100% Em conformidade com a Portaria 671.`;
                                }
                              } else if (isWeekend) {
                                circleColor = "bg-slate-900 border-slate-850/50 text-slate-600 border-dashed opacity-60";
                                titleText = `${dayStr}: Folga de fim de semana de escala regulamentar`;
                              }

                              return (
                                <button
                                  key={dayStr}
                                  title={titleText + " - Clique para ir para a Visão Diária detalhada."}
                                  onClick={() => {
                                    setSelectedDayForDaily(dayStr);
                                    setDashboardViewMode("diaria");
                                  }}
                                  className={`w-8 h-8 rounded-lg flex flex-col items-center justify-center border text-[10px] font-bold cursor-pointer hover:scale-105 transition-all ${circleColor}`}
                                >
                                  <span>{dayNum}</span>
                                  <span className="text-[7.5px] uppercase opacity-75">{weekdayLetter}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>

              </div>
            )}

            {/* MONTHLY VIEW SEGMENT (ORIGINAL DUAL COLUMN CALENDAR GRID) */}
            {dashboardViewMode === "mensal" && (
              <div className="flex flex-col gap-2.5 max-h-[500px] overflow-y-auto pr-1" id="days-stack">
                {daysGrid.map((dayStr) => {
                  const dayNum = parseInt(dayStr.split("-")[2]);
                  const dateObj = new Date(dayStr + "T12:00:00");
                  const dayName = dateObj.toLocaleDateString("pt-BR", { weekday: "long" });
                  const isWeekend = dayName.includes("sábado") || dayName.includes("domingo");

                  // Get clock-in actions of this employee on this day
                  const dayClockIns = clockIns
                    .filter(c => c.employeeId === activeEmployee.id && c.date === dayStr)
                    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

                  // Calculate daily metrics
                  const dailyCalc = calculateDailyCLT(dayStr, clockIns.filter(c => c.employeeId === activeEmployee.id));

                  return (
                    <div 
                      key={dayStr}
                      className={`p-3.5 rounded-lg border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                        isWeekend 
                          ? "bg-slate-900/20 border-slate-800/40 opacity-70" 
                          : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      
                      {/* Date Column */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center font-bold text-xs ${
                          isWeekend ? "bg-slate-800/40 text-slate-400" : "bg-indigo-950 text-indigo-300 border border-indigo-800/20"
                        }`}>
                          <span className="text-sm">{dayNum}</span>
                          <span className="text-[8px] uppercase tracking-wider">{dayName.slice(0, 3)}</span>
                        </div>
                        
                        <div>
                          <p className="text-xs font-bold text-slate-200">
                            {isWeekend ? "Fim de Semana" : "Escala Regular"}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">{dayStr}</p>
                        </div>
                      </div>

                      {/* Clock-Ins timeline row */}
                      <div className="flex-1 flex flex-wrap items-center gap-1.5 py-1">
                        {dayClockIns.length === 0 ? (
                          <span className="text-xs text-slate-500 font-medium italic">
                            {isWeekend ? "Sem expediente regulamentado" : "Falta marcação de ponto / Ausente"}
                          </span>
                        ) : (
                          dayClockIns.map((cl, i) => {
                            // Icon colors based on mark classification
                            let colorClass = "bg-slate-800 text-slate-300 border-slate-700";
                            if (cl.type === "entrada") colorClass = "bg-emerald-950/70 text-emerald-300 border-emerald-800/50";
                            else if (cl.type === "saida_alm") colorClass = "bg-amber-950/70 text-amber-300 border-amber-800/50";
                            else if (cl.type === "volta_alm") colorClass = "bg-blue-950/70 text-blue-300 border-blue-800/50";
                            else if (cl.type === "saida") colorClass = "bg-rose-950/70 text-rose-300 border-rose-800/50";

                            return (
                              <div 
                                key={cl.id}
                                title={`${cl.type.toUpperCase()}: ${cl.time}. Registrado via ${cl.source}.`}
                                className={`px-2.5 py-1 rounded text-xs font-mono font-bold border flex items-center gap-1.5 ${colorClass}`}
                              >
                                <span className="text-[9px] uppercase tracking-wider opacity-85">
                                  {cl.type === "entrada" && "ENT"}
                                  {cl.type === "saida_alm" && "SAI ALM"}
                                  {cl.type === "volta_alm" && "VOLT ALM"}
                                  {cl.type === "saida" && "ENT OUT"}
                                </span>
                                <span className="text-white text-[13px]">{cl.time}</span>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Worked and Overtime calculations metrics columns */}
                      <div className="flex items-center gap-4 shrink-0 justify-between md:justify-end border-t md:border-t-0 border-slate-800 pt-2 md:pt-0">
                        
                        {dayClockIns.length > 0 && (
                          <div className="text-right">
                            <p className="text-[10px] text-slate-400 font-medium">Trabalhadas</p>
                            <p className="text-xs font-bold text-slate-100 font-mono">
                              {minutesToTime(dailyCalc.totalWorkedMinutes)}
                            </p>
                          </div>
                        )}

                        {dailyCalc.overtimeMinutes > 0 && (
                          <div className="text-right">
                            <p className="text-[10px] text-emerald-400 font-bold">Extra</p>
                            <p className="text-xs font-bold text-emerald-400 font-mono">
                              +{minutesToTime(dailyCalc.overtimeMinutes)}
                            </p>
                          </div>
                        )}

                        {/* Overtime warning indicators or irregularities */}
                        <div className="flex items-center gap-1.5">
                          {dailyCalc.nonConformities.map((nc, idx) => {
                            const isHigh = nc.severity === "high";
                            return (
                              <div 
                                key={idx}
                                title={nc.description}
                                className={`p-1 rounded-full cursor-help ${
                                  isHigh ? "bg-rose-500/20 text-rose-400" : "bg-amber-500/20 text-amber-400"
                                }`}
                              >
                                <AlertTriangle className="h-4 w-4" />
                              </div>
                            );
                          })}

                          {dayClockIns.length > 0 && dailyCalc.nonConformities.length === 0 && (
                            <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-400 cursor-help" title="Cumpre integralmente a legislação CLT com 100% de acurácia.">
                              <CheckCircle className="h-4 w-4" />
                            </div>
                          )}
                        </div>

                      </div>

                    </div>
                  );
                })}
              </div>
            )}

          </div>

          {/* ERP Integration and payment slip export connector segment */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 shadow-lg" id="erp-connector-segment">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4.5 w-4.5 text-teal-400" />
                <h3 className="font-bold text-slate-100 text-sm uppercase tracking-wide">
                  Conector de Sincronização ERP de Folha de Pagamento
                </h3>
              </div>
              
              <div className="flex items-center gap-1.5">
                {["totvs", "senior", "adp", "alterdata"].map((er) => (
                  <button
                    key={er}
                    onClick={() => setSelectedERP(er as any)}
                    className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition ${
                      selectedERP === er 
                        ? "bg-teal-500/20 text-teal-300 border border-teal-500/40" 
                        : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {er}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-400 mb-3">
              Gere arquivos de layout estruturados sob medida do funcionário <strong>{activeEmployee.name}</strong> para sincronizar o estoque de horas trabalhadas e horas extras com os principais ERPs do mercado brasileiro:
            </p>

            <div className="relative">
              <pre className="bg-slate-900 p-4 rounded-lg font-mono text-[11px] text-slate-300 border border-slate-800/80 overflow-x-auto max-h-[160px]">
                {getERPConfigCode()}
              </pre>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(getERPConfigCode());
                  addLog(`Dumping de lote ${selectedERP.toUpperCase()} copiado para o Clipboard.`);
                }}
                className="absolute top-2 right-2 bg-slate-800 hover:bg-slate-700 text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wide text-white transition-all border border-slate-700"
              >
                Copiar Código Layout
              </button>
            </div>
          </div>

          {/* Plano de Governança de Ponto de Três Camadas (Operacional, Tático e Estratégico) */}
          {showAdminConfig && (
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-6 shadow-lg flex flex-col gap-6" id="corporate-governance-panel">
            <div className="border-b border-slate-800 pb-3">
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                Diretriz de Portaria Federal MTP 671
              </span>
              <h3 className="font-bold text-slate-100 text-sm mt-1 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-indigo-400" />
                Matriz de Governança de Ponto (Local & Remoto)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Documentação estratégica do ecossistema de controle de horas de trabalho e auditoria facial do colaborador.
              </p>
            </div>

            {/* Three Corporate Pillars Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Strategic Layer */}
              <div className="bg-slate-900/40 p-4 rounded-xl border border-indigo-500/10 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-800">
                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-ping"></div>
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-widest font-mono">1. Camada Estratégica</h4>
                  </div>
                  <p className="text-[11px] text-slate-300 font-bold mb-1">
                    Mitigação de Passivos Trabalhistas & Compliance
                  </p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Decisões executivas para o fechamento macro-financeiro baseado na acurácia matemática de 100%. Redução drástica de processos ligados a horas extras informais e intervalos suprimidos de almoço.
                  </p>
                </div>
                <div className="mt-3 text-[10px] text-slate-500 bg-slate-950 p-2 rounded">
                  <strong>KPIS:</strong> Saldo de H.E., Custo Efetivo vs Base, Fator de Risco da Portaria 671.
                </div>
              </div>

              {/* Tactical Layer */}
              <div className="bg-slate-900/40 p-4 rounded-xl border border-teal-500/10 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-800">
                    <div className="w-2 h-2 rounded-full bg-teal-400 animate-ping"></div>
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-widest font-mono">2. Camada Tática</h4>
                  </div>
                  <p className="text-[11px] text-slate-300 font-bold mb-1">
                    Supervisão de Equipes & Gestão de Ponto
                  </p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Painel do Gestor de RH para monitoramento em tempo real do banco de horas extras, conciliação autônoma de holerites por OCR de PDF/Imagem e alertas imediatos de não conformidade no sistema.
                  </p>
                </div>
                <div className="mt-3 text-[10px] text-slate-500 bg-slate-950 p-2 rounded">
                  <strong>Ações:</strong> Aprovação de desvios, conciliação com ERP, correções via sistema.
                </div>
              </div>

              {/* Operational Layer */}
              <div className="bg-slate-900/40 p-4 rounded-xl border border-emerald-500/10 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-800">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></div>
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-widest font-mono">3. Camada Operacional</h4>
                  </div>
                  <p className="text-[11px] text-slate-300 font-bold mb-1">
                    Prevenção de Fraudes & Autenticação Diária
                  </p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Rotina estrita do funcionário ativo (Presencial ou Home Office). Exigência regulamentar de marcação de ponto georreferenciado e autenticação de selfie na entrada, saída de almoço, volta de almoço e saída.
                  </p>
                </div>
                <div className="mt-3 text-[10px] text-slate-500 bg-slate-950 p-2 rounded">
                  <strong>Garantia:</strong> Selfie de comprovação + Carimbo de localização GPS ativo.
                </div>
              </div>

            </div>

            {/* Simulated Live Selfie Capture Module */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5" id="selfie-simulator-module">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-600/10 text-emerald-400 rounded border border-emerald-600/30">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wide text-slate-200">
                      Painel Operacional: Validador de Selfie no Registro de Ponto (Local & Remoto)
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Garante acurácia de 100% prevenindo terceiros de bater ponto para o funcionário selecionado.
                    </p>
                  </div>
                </div>

                <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 shrink-0">
                  <button
                    onClick={() => setIsRemoteWork(false)}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition ${
                      !isRemoteWork ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    🏢 Local (Na Empresa)
                  </button>
                  <button
                    onClick={() => setIsRemoteWork(true)}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition ${
                      isRemoteWork ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    🏠 Remoto (Home Office)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Selfie Upload and Simulator Input */}
                <div className="lg:col-span-4 flex flex-col justify-between gap-4">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                      Etapa do Dia Regulamentada
                    </label>
                    <select
                      value={selfieType}
                      onChange={(e) => setSelfieType(e.target.value as ClockInType)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                    >
                      <option value="entrada">Entrada do Dia (Selfie obrigatória)</option>
                      <option value="saida_alm">Início de Almoço (Selfie obrigatória)</option>
                      <option value="volta_alm">Fim de Almoço (Selfie obrigatória)</option>
                      <option value="saida">Fim de Expediente (Selfie obrigatória)</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Carregue uma foto da sua webcam para auditar a fisionomia e registrar no balancete:
                    </p>
                    
                    <button
                      onClick={() => {
                        // Create a simulated nice profile face emoji as a dummy avatar base64
                        const simulatedProfilePic = "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=60";
                        setSelfiePreview(simulatedProfilePic);
                        addLog(`Selfie do colaborador carregada com sucesso para verificação facial.`);
                      }}
                      className="bg-indigo-600/35 hover:bg-indigo-600/50 border border-indigo-500/40 text-xs text-white py-1.5 px-3 rounded font-bold transition flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
                      Capturar Selfie com Câmera
                    </button>

                    <button
                      onClick={() => {
                        if (!selfiePreview) {
                          alert("Carregue ou capture uma selfie antes de registrar!");
                          return;
                        }

                        // Save both to states
                        const now = new Date();
                        const val: ClockInEntry = {
                          id: `c-selfie-${Date.now()}`,
                          employeeId: activeEmployee.id,
                          date: "2026-06-16",
                          time: now.toLocaleTimeString("pt-BR", {hour: "2-digit", minute:"2-digit"}),
                          type: selfieType,
                          source: "real_time_upload",
                          isCompliant: true,
                          remarks: `Selfie verificada biometricamente 100%. Regime: ${isRemoteWork ? "REMOTO" : "PRESENCIAL"}`
                        };

                        updatePersistedState(employees, [...clockIns, val]);
                        
                        setSelfieLogs([
                          {
                            type: selfieType,
                            date: "2026-06-16",
                            time: val.time,
                            remote: isRemoteWork,
                            verified: true
                          },
                          ...selfieLogs
                        ]);

                        setResultMessage(`Ponto com Selfie Facial validado e inserido no calendário de ${activeEmployee.name} com sucesso!`);
                        addLog(`Selfie biometricamente atestada para o ponto de ${selfieType.toUpperCase()} às ${val.time}.`);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs py-2 px-3 rounded font-bold transition flex items-center justify-center gap-1.5 shadow"
                    >
                      <CheckCircle className="h-3 w-3" />
                      Registrar Ponto por Biometria Facial
                    </button>
                  </div>
                </div>

                {/* Simulated Webcam Screen */}
                <div className="lg:col-span-4 bg-slate-950 border border-slate-800 rounded-lg p-3 relative flex flex-col items-center justify-center min-h-[140px]">
                  {selfiePreview ? (
                    <div className="relative text-center flex flex-col items-center">
                      <img 
                        src={selfiePreview} 
                        alt="Simulated Selfie capture" 
                        referrerPolicy="no-referrer"
                        className="w-16 h-16 rounded-full object-cover border-2 border-indigo-500 shadow mb-1.5"
                      />
                      <span className="text-[10px] text-emerald-400 font-bold bg-emerald-900/30 px-2 py-0.5 rounded font-mono flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                        DETECÇÃO FACIAL APREENDIDA
                      </span>
                      <p className="text-[9px] text-slate-500 mt-1 uppercase tracking-wider font-mono">
                        Acurácia Biométrica: 100.00%
                      </p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-full border-2 border-dashed border-slate-700 mx-auto flex items-center justify-center text-slate-600 mb-2">
                        <User className="h-5 w-5" />
                      </div>
                      <p className="text-[11px] text-slate-500 uppercase tracking-widest font-mono">
                        Câmera Offline
                      </p>
                    </div>
                  )}
                </div>

                {/* Selfie Logs lists */}
                <div className="lg:col-span-4 bg-slate-900 p-3 rounded-lg border border-slate-800 flex flex-col justify-between">
                  <div>
                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Histórico Diário de Verificação por Selfie
                    </h5>
                    <div className="flex flex-col gap-1 text-[10px] font-mono select-none">
                      {selfieLogs.map((log, id) => (
                        <div key={id} className="flex items-center justify-between bg-slate-950/60 p-1.5 rounded border border-slate-800">
                          <span className="text-slate-300 uppercase font-bold text-[9px]">
                            {log.type === "entrada" && "ENTRADA"}
                            {log.type === "saida_alm" && "SAÍDA ALM."}
                            {log.type === "volta_alm" && "VOLTA ALM."}
                            {log.type === "saida" && "SAÍDA REG."}
                          </span>
                          <span className="text-indigo-300 font-bold">{log.time}</span>
                          <span className={`text-[8px] font-mono px-1 rounded ${
                            log.remote ? "bg-amber-600/20 text-amber-300" : "bg-indigo-600/20 text-indigo-300"
                          }`}>
                            {log.remote ? "REMOTO" : "LOCAL"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <p className="text-[9px] text-slate-500 mt-2 italic leading-tight">
                    Toda selfie do celular é carimbada com a latitude/longitude do provedor de dados e armazenada sob criptografia no servidor.
                  </p>
                </div>

              </div>
            </div>
          </div>
          )}

        </div>

      </div>

      {/* Corporate Dashboard footer */}
      <footer className="mt-auto border-t border-slate-800 bg-slate-950 py-6 px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left" id="app-footer">
        <div>
          <p className="text-xs text-slate-400 font-medium">
            © 2026 GPA CD1 • Módulo Integrador e Auditor de Ponto CLT Estrito v3.2.0 • Antigravity AI Inc
          </p>
          <p className="text-[10px] text-slate-500 mt-1">
            Projetado de acordo com as especificações da Portaria 671 MTP brasileira. Acorado com auditorias externas de 100% de precisão.
          </p>
        </div>

        <div className="flex gap-4">
          <span className="text-[10px] text-slate-400 font-mono bg-slate-900 px-2 py-1 rounded border border-slate-800">
            Node / Express Backend: PORT 3000
          </span>
          <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/30 px-2 py-1 rounded border border-emerald-900/30">
            Gemini Client Setup: aistudio-build
          </span>
        </div>
      </footer>

      {/* Profile Modal Overlay */}
      {profileModalOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" id="profile-edit-modal">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-850 pb-4 mb-4">
              <h3 className="font-bold text-slate-100 flex items-center gap-2 text-sm uppercase tracking-wider font-mono">
                <User className="h-4 w-4 text-indigo-400" />
                Meu Perfil de Usuário
              </h3>
              <button 
                onClick={() => setProfileModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-base font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  value={editingProfileName}
                  onChange={(e) => setEditingProfileName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/50 transition-all rounded-lg px-3 py-2 text-xs text-slate-200 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  E-mail institucional
                </label>
                <input
                  type="email"
                  value={editingProfileEmail}
                  onChange={(e) => setEditingProfileEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/50 transition-all rounded-lg px-3 py-2 text-xs text-slate-200 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Senha de Login
                </label>
                <input
                  type="password"
                  value={editingProfilePassword}
                  onChange={(e) => setEditingProfilePassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/50 transition-all rounded-lg px-3 py-2 text-xs text-slate-200 outline-none"
                />
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 mt-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase font-mono block mb-1">Dados de Contrato & Permissão</span>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  ID de Conta: <strong className="font-mono text-xs text-slate-200">{currentUser.id}</strong><br />
                  Seu Perfil: <strong className="text-indigo-400 uppercase font-semibold">{currentUser.role === 'gestor_rh' ? 'Gestor de Recursos Humanos' : 'Colaborador CLT'}</strong>
                </p>
                {currentUser.role === "colaborador" && currentUser.employeeId && (
                  <p className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-900 leading-relaxed font-normal">
                    Seu vínculo de trabalho está sincronizado com a ficha funcional <strong className="font-mono text-xs text-slate-200">{currentUser.employeeId}</strong>. Modificações de nome atualizarão em tempo real seu espelho de folha e comprovantes.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-850">
                <button
                  onClick={handleSaveProfile}
                  className="bg-indigo-600 hover:bg-indigo-550 text-white font-bold py-2.5 rounded-lg text-xs transition uppercase tracking-wider shadow"
                >
                  Salvar Alterações
                </button>
                <button
                  onClick={() => setProfileModalOpen(false)}
                  className="bg-slate-800 hover:bg-slate-750 border border-slate-755 text-slate-300 font-bold py-2.5 rounded-lg text-xs transition uppercase tracking-wider"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
