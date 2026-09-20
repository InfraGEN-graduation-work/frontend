import React, { useState, useEffect} from 'react';
import { useNavigate } from 'react-router-dom';
import styled, { keyframes, css } from 'styled-components';
import logo from '../assets/mainlogo.png';
import { useAuth } from '../contexts/AuthContext';
import type { CloudProvider } from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://infragen.p-e.kr/api/v1';

interface Project {
  projectId: number;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  myRole?: string;
}

interface Collaborator {
  memberId: number | string;
  nickname: string;
  email?: string;
  role: 'EDITOR' | 'VIEWER' | 'OWNER';
  status?: 'PENDING' | 'ACCEPTED';
}

interface Invitation {
  invitationId: number;
  projectId: number;
  projectTitle: string;
  inviterNickname: string;
  status?: string;
}

export default function Home() {
  const navigate = useNavigate();
  const { fetchWithAuth, logout, isAutoSaveEnabled, setIsAutoSaveEnabled } = useAuth();

  const [userInfo, setUserInfo] = useState({ id: 0, nickname: '로딩중...', email: '로딩중...', provider: 'LOCAL', inviteCode: '불러오는 중...' });
  const [projects, setProjects] = useState<Project[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  const [filterMode, setFilterMode] = useState<'ALL' | 'OWNER' | 'PARTICIPANT'>('ALL');

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [modalProvider, setModalProvider] = useState<CloudProvider | ''>('LOCAL');
  const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false);

  const [editTargetId, setEditTargetId] = useState<number | null>(null);
  const [editNodes, setEditNodes] = useState<any[]>([]);
  const [editEdges, setEditEdges] = useState<any[]>([]);

  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);

  const [isCollabModalOpen, setIsCollabModalOpen] = useState(false);
  const [collabProjectId, setCollabProjectId] = useState<number | null>(null);
  const [collabTab, setCollabTab] = useState<'list' | 'invite'>('list');
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteRole, setInviteRole] = useState<'EDITOR' | 'VIEWER'>('VIEWER');

  const [collabSearchTerm, setCollabSearchTerm] = useState('');
  const [isCollabEditMode, setIsCollabEditMode] = useState(false);

  const [openRoleDropdownId, setOpenRoleDropdownId] = useState<number | string | null>(null);
  const [openInviteRoleDropdown, setOpenInviteRoleDropdown] = useState(false);

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isUserInfoModalOpen, setIsUserInfoModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [editProfileForm, setEditProfileForm] = useState({ nickname: '', password: '', passwordConfirm: '' });

  const [projectToDelete, setProjectToDelete] = useState<number | null>(null);
  const [projectToLeave, setProjectToLeave] = useState<number | null>(null);
  const [collaboratorToRemove, setCollaboratorToRemove] = useState<number | string | null>(null);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [isWithdrawConfirmOpen, setIsWithdrawConfirmOpen] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isCodeViewerOpen, setIsCodeViewerOpen] = useState(false);
  const [codeViewerFiles, setCodeViewerFiles] = useState<any[]>([]);
  const [codeViewerNodes, setCodeViewerNodes] = useState<any[]>([]);
  const [selectedViewFile, setSelectedViewFile] = useState<any>(null);

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historySortOrder, setHistorySortOrder] = useState<'desc' | 'asc'>('desc');
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  useEffect(() => {
    const handleClickOutside = () => {
      setMenuOpenId(null);
      setIsProfileMenuOpen(false);
      setIsProviderDropdownOpen(false);
      setOpenRoleDropdownId(null);
      setOpenInviteRoleDropdown(false);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleGlobalToast = (e: any) => {
      setToastMessage(e.detail);
      setTimeout(() => setToastMessage(null), 3000);
    };
    window.addEventListener('global-toast', handleGlobalToast);
    return () => window.removeEventListener('global-toast', handleGlobalToast);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const userRes = await fetchWithAuth(`${BASE_URL}/members/me`);
      if (userRes.status === 401) {
        navigate('/login');
        return;
      }

      const userData = await userRes.json();
      let fetchedInviteCode = '코드 발급 실패';

      if (userRes.ok && (userData.isSuccess ?? userData.is_success)) {
        try {
          const codeRes = await fetchWithAuth(`${BASE_URL}/members/me/invitation-code`, { 
            method: 'POST'
          });
          if (codeRes.ok) {
            const codeData = await codeRes.json();
            if (codeData.isSuccess ?? codeData.is_success) {
              fetchedInviteCode = codeData.result?.inviteCode || (typeof codeData.result === 'string' ? codeData.result : '코드 없음');
            }
          }
        } catch (e) {}

        const rawProvider = userData.result.provider || userData.result.socialType || userData.result.loginType || 'LOCAL';
        setUserInfo({ 
          id: userData.result.id, 
          nickname: userData.result.nickname, 
          email: userData.result.email,
          provider: String(rawProvider).toUpperCase(),
          inviteCode: fetchedInviteCode
        });

        if(userData.result.autoSaveEnabled !== undefined) {
          setIsAutoSaveEnabled(userData.result.autoSaveEnabled);
        }
      }

      const projRes = await fetchWithAuth(`${BASE_URL}/projects`);
      const projData = await projRes.json();

      if (projRes.ok && (projData.isSuccess ?? projData.is_success)) {
        const mappedProjects = (projData.result.projectList || []).map((p: any) => ({ 
          ...p, 
          myRole: p.accessRole || p.role || 'OWNER' 
        }));
        setProjects(mappedProjects);
      }

      const invRes = await fetchWithAuth(`${BASE_URL}/project-collaborator-invitations/received?status=PENDING`);
      if (invRes.ok) {
        const invData = await invRes.json();
        if (invData.isSuccess ?? invData.is_success) {
          const list = Array.isArray(invData.result) ? invData.result : (invData.result?.invitations || []);
          setInvitations(list.filter((i: any) => i.status === 'PENDING'));
        }
      }
    } catch (err) {}
  };

  useEffect(() => {
    fetchDashboardData();
  }, [navigate, fetchWithAuth, setIsAutoSaveEnabled]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    window.dispatchEvent(new CustomEvent('global-toast', { detail: '초대 코드가 복사되었습니다.' }));
  };

  const handleOpenCollabModal = async (e: React.MouseEvent, projectId: number) => {
    e.stopPropagation();
    setMenuOpenId(null);
    setCollabProjectId(projectId);
    setCollabTab('list');
    setInviteCode('');
    setInviteRole('VIEWER');
    setCollabSearchTerm('');
    setIsCollabEditMode(false);
    setOpenRoleDropdownId(null);
    setIsCollabModalOpen(true);
    fetchCollaborators(projectId);
  };

  const fetchCollaborators = async (projectId: number) => {
    try {
      const res1 = await fetchWithAuth(`${BASE_URL}/projects/${projectId}/collaborators`);
      let activeMembers: Collaborator[] = [];
      if (res1.ok) {
        const data1 = await res1.json();
        if (data1.isSuccess ?? data1.is_success) {
          activeMembers = (data1.result.collaborators || []).map((c: any) => ({
            ...c,
            status: 'ACCEPTED'
          }));
        }
      }

      let pendingMembers: Collaborator[] = [];
      const project = projects.find(p => p.projectId === projectId);

      if (project?.myRole === 'OWNER') {
        try {
          const res2 = await fetchWithAuth(`${BASE_URL}/projects/${projectId}/collaborators/invitations`);
          if (res2.ok) {
            const data2 = await res2.json();
            if (data2.isSuccess ?? data2.is_success) {
              pendingMembers = (data2.result?.invitations || [])
                .filter((inv: any) => inv.status === 'PENDING')
                .map((inv: any) => ({
                  memberId: `inv-${inv.invitationId}`,
                  nickname: inv.inviteeNickname,
                  role: inv.role,
                  status: 'PENDING'
                }));
            }
          }
        } catch (e) {}
      }

      setCollaborators([...activeMembers, ...pendingMembers]);
    } catch (err) {}
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collabProjectId || !inviteCode.trim()) return;

    if (inviteCode.trim() === String(userInfo.inviteCode)) {
      window.dispatchEvent(new CustomEvent('global-toast', { detail: '본인은 초대할 수 없습니다.' }));
      return;
    }

    try {
      const payload = {
        inviteeCode: inviteCode.trim(),
        role: inviteRole
      };

      const res = await fetchWithAuth(`${BASE_URL}/projects/${collabProjectId}/collaborators/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));
      const isSuccess = data.isSuccess ?? data.is_success ?? res.ok;

      if (isSuccess) {
        window.dispatchEvent(new CustomEvent('global-toast', { detail: '참여자에게 초대를 성공적으로 보냈습니다.' }));
        setInviteCode('');
        setCollabTab('list');
        fetchCollaborators(collabProjectId); 
      } else {
        window.dispatchEvent(new CustomEvent('global-toast', { detail: data.message || '참여자 초대에 실패했습니다.' }));
      }
    } catch (err) {
      window.dispatchEvent(new CustomEvent('global-toast', { detail: '서버 연동 오류가 발생했습니다.' }));
    }
  };

  const handleAcceptInvite = async (invitationId: number) => {
    try {
      const res = await fetchWithAuth(`${BASE_URL}/project-collaborator-invitations/${invitationId}/accept`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      const isSuccess = data.isSuccess ?? data.is_success ?? res.ok;

      if (isSuccess) {
        window.dispatchEvent(new CustomEvent('global-toast', { detail: '프로젝트 초대를 수락했습니다.' }));
        setIsInviteModalOpen(false);
        fetchDashboardData(); 
      } else {
        window.dispatchEvent(new CustomEvent('global-toast', { detail: data.message || '초대 수락 처리 중 오류가 발생했습니다.' }));
      }
    } catch (err) {
      window.dispatchEvent(new CustomEvent('global-toast', { detail: '서버 통신 오류가 발생했습니다.' }));
    }
  };

  const handleRejectInvite = async (invitationId: number) => {
    try {
      const res = await fetchWithAuth(`${BASE_URL}/project-collaborator-invitations/${invitationId}/decline`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      const isSuccess = data.isSuccess ?? data.is_success ?? res.ok;

      if (isSuccess) {
        setInvitations(prev => prev.filter(inv => inv.invitationId !== invitationId));
        window.dispatchEvent(new CustomEvent('global-toast', { detail: '초대를 거절했습니다.' }));
        if (invitations.length <= 1) setIsInviteModalOpen(false); 
      } else {
        window.dispatchEvent(new CustomEvent('global-toast', { detail: data.message || '거절 처리 중 오류가 발생했습니다.' }));
      }
    } catch (err) {
      window.dispatchEvent(new CustomEvent('global-toast', { detail: '서버 통신 오류가 발생했습니다.' }));
    }
  };

  const handleRemoveCollaborator = (memberId: number | string) => {
    if (!collabProjectId) return;
    setCollaboratorToRemove(memberId);
  };

  const confirmRemoveCollaborator = async () => {
    if (!collabProjectId || !collaboratorToRemove) return;

    try {
      let res;
      if (typeof collaboratorToRemove === 'string' && collaboratorToRemove.startsWith('inv-')) {
        const invitationId = collaboratorToRemove.replace('inv-', '');
        res = await fetchWithAuth(`${BASE_URL}/project-collaborator-invitations/${invitationId}/decline`, {
          method: 'POST'
        });
      } else {
        res = await fetchWithAuth(`${BASE_URL}/projects/${collabProjectId}/collaborators/${collaboratorToRemove}`, {
          method: 'DELETE'
        });
      }

      if (res.ok) {
        setCollaborators(prev => prev.filter(c => c.memberId !== collaboratorToRemove));
        window.dispatchEvent(new CustomEvent('global-toast', { detail: '성공적으로 처리되었습니다.' }));
      } else {
        const text = await res.text();
        let msg = '처리 중 오류가 발생했습니다.';
        try {
          const data = JSON.parse(text);
          if (data.message) msg = data.message;
        } catch(e) {}
        window.dispatchEvent(new CustomEvent('global-toast', { detail: msg }));
      }
    } catch (err) {
      window.dispatchEvent(new CustomEvent('global-toast', { detail: '서버 연동 오류가 발생했습니다.' }));
    } finally {
      setCollaboratorToRemove(null);
    }
  };

  const handleRoleChange = async (memberId: number | string, newRole: string) => {
    if (!collabProjectId) return;

    if (typeof memberId === 'string' && memberId.startsWith('inv-')) {
      window.dispatchEvent(new CustomEvent('global-toast', { detail: '수락 대기 중인 사용자의 권한은 임의로 변경할 수 없습니다.' }));
      return;
    }

    try {
      const res = await fetchWithAuth(`${BASE_URL}/projects/${collabProjectId}/collaborators/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        setCollaborators(prev => prev.map(c => c.memberId === memberId ? { ...c, role: newRole as 'EDITOR' | 'VIEWER' } : c));
        window.dispatchEvent(new CustomEvent('global-toast', { detail: '권한이 변경되었습니다.' }));
      }
    } catch (err) {}
  };

  const handleSubmitProject = async (e: React.FormEvent) => {
    e.preventDefault();

    const isEditingTargetOwner = modalMode === 'create' || projects.find(p => p.projectId === editTargetId)?.myRole === 'OWNER';
    if (!isEditingTargetOwner) return;

    if (!newTitle.trim()) return window.dispatchEvent(new CustomEvent('global-toast', { detail: '프로젝트 이름을 입력해주세요.' }));
    if (modalMode === 'create' && !modalProvider) return window.dispatchEvent(new CustomEvent('global-toast', { detail: '클라우드 환경을 선택해주세요.' }));

    if (modalMode === 'create') {
      try {
        const res = await fetchWithAuth(`${BASE_URL}/projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newTitle, description: newDesc }),
        });

        const data = await res.json();
        if (res.ok && (data.isSuccess ?? data.is_success)) {
          setModalMode(null);
          navigate(`/project/${data.result.projectId}`, { state: { initialProvider: modalProvider as CloudProvider } });
        }
      } catch (err) {}
    } 
    else if (modalMode === 'edit' && editTargetId !== null) {
      try {
        let currentVersion = 0;
        try {
          const collabRes = await fetchWithAuth(`${BASE_URL}/projects/${editTargetId}/collaboration`);
          if (collabRes.ok) {
            const collabData = await collabRes.json();
            currentVersion = collabData.result?.graphVersion ?? 0;
          }
        } catch (e) {}

        const cleanNodes = editNodes.map((n: any) => {
          let props = n.properties || {};
          if (typeof props === 'string') {
            try { props = JSON.parse(props); } catch (e) {}
          }
          props.globalCloudProvider = modalProvider;
          return {
            nodeId: n.nodeId,
            nodeName: n.nodeName,
            componentType: n.componentType,
            positionX: n.positionX,
            positionY: n.positionY,
            properties: props
          };
        });

        const cleanEdges = editEdges.map((e: any) => ({
          sourceNodeId: e.sourceNodeId,
          targetNodeId: e.targetNodeId
        }));

        const res = await fetchWithAuth(`${BASE_URL}/projects/${editTargetId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: newTitle,
            description: newDesc,
            nodes: cleanNodes,
            edges: cleanEdges,
            baseVersion: currentVersion 
          }),
        });

        const data = await res.json();
        if (res.ok && (data.isSuccess ?? data.is_success)) {
          setModalMode(null);
          setProjects(prev => prev.map(p => 
            p.projectId === editTargetId 
              ? { ...p, title: newTitle, description: newDesc } 
              : p
          ));
          window.dispatchEvent(new CustomEvent('global-toast', { detail: '프로젝트 정보가 수정되었습니다.' }));
        } else {
          window.dispatchEvent(new CustomEvent('global-toast', { detail: data.message || '수정에 실패했습니다.' }));
        }
      } catch (err) {
        window.dispatchEvent(new CustomEvent('global-toast', { detail: '서버 오류가 발생했습니다.' }));
      }
    }
  };

  const handleOpenEdit = async (e: React.MouseEvent, proj: Project) => {
    e.stopPropagation();
    setMenuOpenId(null);

    try {
      const isOwner = proj.myRole === 'OWNER';
      const url = isOwner
        ? `${BASE_URL}/projects/${proj.projectId}`
        : `${BASE_URL}/projects/${proj.projectId}/collaboration?afterVersion=0`;

      const res = await fetchWithAuth(url);
      const data = await res.json();

      if (res.ok && (data.isSuccess ?? data.is_success)) {
        const result = isOwner ? data.result : data.result?.project;
        if (!result) throw new Error("데이터 구조 오류");

        setNewTitle(result.title);
        setNewDesc(result.description || '');
        setEditNodes(result.nodes || []);
        setEditEdges(result.edges || []);
        setEditTargetId(proj.projectId);

        const fetchedNodes = result.nodes || [];
        let provider: CloudProvider = 'LOCAL';
        if (fetchedNodes.length > 0) {
          let props = fetchedNodes[0].properties || {};
          if (typeof props === 'string') {
            try { props = JSON.parse(props); } catch (e) {}
          }
          provider = props.globalCloudProvider || 'LOCAL';
        }
        setModalProvider(provider);
        setModalMode('edit');
      } else {
        window.dispatchEvent(new CustomEvent('global-toast', { detail: '프로젝트 정보를 불러오지 못했습니다.' }));
      }
    } catch (err) {
       window.dispatchEvent(new CustomEvent('global-toast', { detail: '서버 오류가 발생했습니다.' }));
    }
  };

  const handleDeleteSingle = (e: React.MouseEvent, projectId: number) => {
    e.stopPropagation();
    setMenuOpenId(null);
    setProjectToDelete(projectId);
  };

  const confirmDeleteSingle = async () => {
    if (!projectToDelete) return;
    try {
      const res = await fetchWithAuth(`${BASE_URL}/projects/${projectToDelete}`, { 
        method: 'DELETE'
      });

      if (res.ok) {
        setProjects(prev => prev.filter((p) => p.projectId !== projectToDelete));
        window.dispatchEvent(new CustomEvent('global-toast', { detail: '프로젝트가 삭제되었습니다.' }));
      } else {
        const text = await res.text();
        let msg = '프로젝트 삭제에 실패했습니다.';
        try {
          const data = JSON.parse(text);
          if (data.message) msg = data.message;
        } catch(e) {}
        window.dispatchEvent(new CustomEvent('global-toast', { detail: msg }));
      }
    } catch (err) {
      window.dispatchEvent(new CustomEvent('global-toast', { detail: '예기치 않은 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }));
    } finally {
      setProjectToDelete(null);
    }
  };

  const handleLeaveSingle = (e: React.MouseEvent, projectId: number) => {
    e.stopPropagation();
    setMenuOpenId(null);
    setProjectToLeave(projectId);
  };

  const confirmLeaveSingle = async () => {
    if (!projectToLeave) return;
    try {
      const res = await fetchWithAuth(`${BASE_URL}/projects/${projectToLeave}/collaborators/${userInfo.id}`, { method: 'DELETE' });

      if (res.ok) {
        setProjects(prev => prev.filter((p) => p.projectId !== projectToLeave));
        window.dispatchEvent(new CustomEvent('global-toast', { detail: '프로젝트에서 나갔습니다.' }));
      } else {
        const text = await res.text();
        let msg = '프로젝트 나가기에 실패했습니다.';
        try {
          const data = JSON.parse(text);
          if (data.message) msg = data.message;
        } catch(e) {}
        window.dispatchEvent(new CustomEvent('global-toast', { detail: msg }));
      }
    } catch (err) {
      window.dispatchEvent(new CustomEvent('global-toast', { detail: '예기치 않은 오류가 발생했습니다.' }));
    } finally {
      setProjectToLeave(null);
    }
  };

  const confirmBulkDelete = async () => {
    try {
      const results = await Promise.all(
        selectedIds.map(async (id) => {
          try {
            const proj = projects.find(p => p.projectId === id);
            const isOwner = proj?.myRole === 'OWNER';
            const endpoint = isOwner 
              ? `${BASE_URL}/projects/${id}`
              : `${BASE_URL}/projects/${id}/collaborators/${userInfo.id}`;

            const res = await fetchWithAuth(endpoint, { method: 'DELETE' });
            return { id, isSuccess: res.ok };
          } catch(e) { return { id, isSuccess: false }; }
        })
      );

      const successIds = results.filter(r => r.isSuccess).map(r => r.id);

      if (successIds.length > 0) {
        setProjects(prev => prev.filter(p => !successIds.includes(p.projectId)));
        window.dispatchEvent(new CustomEvent('global-toast', { detail: `${successIds.length}개의 프로젝트가 정리되었습니다.` }));
      } else {
        window.dispatchEvent(new CustomEvent('global-toast', { detail: '선택한 프로젝트 정리에 실패했습니다.' }));
      }
    } catch (err) {
      window.dispatchEvent(new CustomEvent('global-toast', { detail: '예기치 않은 서버 오류가 발생했습니다.' }));
    } finally {
      setSelectedIds([]);
      setIsSelectMode(false);
      setIsBulkDeleteConfirmOpen(false);
    }
  };

  const handleOpenUserInfo = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditProfileForm({ nickname: userInfo.nickname, password: '', passwordConfirm: '' });
    setIsUserInfoModalOpen(true);
    setIsProfileMenuOpen(false);
  };

  const hasProfileChanges = 
    editProfileForm.nickname !== userInfo.nickname || 
    (userInfo.provider !== 'KAKAO' && editProfileForm.password !== '');

  const handleUpdateUserInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasProfileChanges) { setIsUserInfoModalOpen(false); return; }

    if (userInfo.provider !== 'KAKAO') {
      if (editProfileForm.password && editProfileForm.password.length < 8) {
        window.dispatchEvent(new CustomEvent('global-toast', { detail: '비밀번호는 8자 이상이어야 합니다.' }));
        return;
      }
      if (editProfileForm.password && editProfileForm.password !== editProfileForm.passwordConfirm) {
        window.dispatchEvent(new CustomEvent('global-toast', { detail: '비밀번호가 일치하지 않습니다.' }));
        return;
      }
    }

    try {
      const payload: any = { nickname: editProfileForm.nickname };
      if (userInfo.provider !== 'KAKAO' && editProfileForm.password) payload.password = editProfileForm.password;

      const res = await fetchWithAuth(`${BASE_URL}/members/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));
      const isSuccess = data.isSuccess ?? data.is_success ?? res.ok;

      if (!res.ok || !isSuccess) throw new Error(data.message || `서버 연동 오류 (${res.status})`);

      setUserInfo(prev => ({ ...prev, nickname: editProfileForm.nickname }));
      setIsUserInfoModalOpen(false);
      window.dispatchEvent(new CustomEvent('global-toast', { detail: '회원정보가 성공적으로 수정되었습니다.' }));
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('global-toast', { detail: err.message || '오류가 발생했습니다.' }));
    }
  };

  const executeWithdraw = async () => {
    try {
      await Promise.all(
        projects.map(async (proj) => {
          try {
            if (proj.myRole === 'OWNER') {
              await fetchWithAuth(`${BASE_URL}/projects/${proj.projectId}`, { method: 'DELETE' });
            } else {
              await fetchWithAuth(`${BASE_URL}/projects/${proj.projectId}/collaborators/${userInfo.id}`, { method: 'DELETE' });
            }
          } catch (err) {}
        })
      );

      const res = await fetchWithAuth(`${BASE_URL}/members/me`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      const isSuccess = data.isSuccess ?? data.is_success ?? res.ok;

      if (!res.ok || !isSuccess) throw new Error(data.message);

      setIsWithdrawConfirmOpen(false);
      setIsUserInfoModalOpen(false);
      window.dispatchEvent(new CustomEvent('global-toast', { detail: '회원 탈퇴가 완료되었습니다.' }));
      setTimeout(() => { logout(); }, 1500);
    } catch (err: any) {
      setIsWithdrawConfirmOpen(false);
      window.dispatchEvent(new CustomEvent('global-toast', { detail: err.message || '오류가 발생했습니다.' }));
    }
  };

  const handleOpenHistory = async (e: React.MouseEvent, projectId: number) => {
    e.stopPropagation();
    setMenuOpenId(null);
    setIsHistoryModalOpen(true);
    setIsHistoryLoading(true);
    setHistorySortOrder('desc');

    try {
      const res = await fetchWithAuth(`${BASE_URL}/projects/${projectId}/histories`);
      const data = await res.json();

      if (res.ok && (data.isSuccess ?? data.is_success)) {
        let list = [];
        if (Array.isArray(data.result)) {
          list = data.result;
        } else if (data.result?.historyList) {
          list = data.result.historyList;
        }
        setHistoryList(list);
      } else {
        setHistoryList([]);
      }
    } catch (err) {
      setHistoryList([]);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleOpenCodeViewer = async (e: React.MouseEvent, projectId: number) => {
    e.stopPropagation();
    setMenuOpenId(null);
    try {
      const proj = projects.find(p => p.projectId === projectId);
      const isOwner = proj?.myRole === 'OWNER';

      const url = isOwner
        ? `${BASE_URL}/projects/${projectId}`
        : `${BASE_URL}/projects/${projectId}/collaboration?afterVersion=0`;

      const projRes = await fetchWithAuth(url);
      const projObj = await projRes.json();
      const result = isOwner ? projObj.result : projObj.result?.project;
      const nodes = result?.nodes || [];

      const allFiles: any[] = [];
      const folderMap = new Map();

      nodes.forEach((n: any) => {
        let props = n.properties || {};
        if (typeof props === 'string') {
          try { props = JSON.parse(props); } catch (err) {}
        }

        if (props.fileId && (String(props.fileIsGenerated) === 'true' || props.fileIsGenerated === true)) {
          if (!folderMap.has(props.fileId)) {
            let parsedFiles = [];
            try {
              parsedFiles = typeof props.fileGeneratedCodes === 'string' 
                ? JSON.parse(props.fileGeneratedCodes) 
                : (props.fileGeneratedCodes || []);
            } catch(err) {}

            folderMap.set(props.fileId, true);

            parsedFiles.forEach((gf: any, idx: number) => {
              allFiles.push({
                fileId: `${props.fileId}-${idx}`,
                folderName: props.fileName || '폴더',
                fileName: gf.fileName,
                content: gf.content
              });
            });
          }
        }
      });

      if (allFiles.length === 0) {
        try {
          const histRes = await fetchWithAuth(`${BASE_URL}/projects/${projectId}/histories`);
          const histData = await histRes.json();
          let histList = Array.isArray(histData.result) ? histData.result : (histData.result?.historyList || []);

          histList = histList.sort((a: any, b: any) => b.historyId - a.historyId);

          for (const hist of histList) {
            const detailRes = await fetchWithAuth(`${BASE_URL}/projects/${projectId}/histories/${hist.historyId}`);
            const detailData = await detailRes.json();
            const detailResult = detailData.result || {};
            const genFiles = detailResult.generatedFileList || detailResult.files || [];

            if (genFiles.length > 0) {
              genFiles.forEach((gf: any, idx: number) => {
                allFiles.push({
                  fileId: `hist-${hist.historyId}-${idx}`,
                  folderName: '생성된 인프라 코드',
                  fileName: gf.fileName,
                  content: gf.content
                });
              });
              break; 
            }
          }
        } catch(e) {}
      }

      if (allFiles.length === 0) {
        window.dispatchEvent(new CustomEvent('global-toast', { detail: '생성된 코드 내역이 없습니다. (에디터에서 Generate를 진행해주세요)' }));
        return;
      }

      setCodeViewerFiles(allFiles);
      setCodeViewerNodes(nodes);
      setSelectedViewFile(allFiles[0]);

      setIsCodeViewerOpen(true);
    } catch (err) {
      window.dispatchEvent(new CustomEvent('global-toast', { detail: '코드를 불러오는 중 서버 오류가 발생했습니다.' }));
    }
  };

  const formatDate = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  };

  const formatDateTime = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${y}.${m}.${d} ${hh}:${mm}`;
  };

  const sortedHistory = [...historyList].sort((a, b) => {
    return historySortOrder === 'desc' 
      ? b.historyId - a.historyId 
      : a.historyId - b.historyId; 
  });

  const handleFilterToggle = () => {
    if (filterMode === 'ALL') setFilterMode('OWNER');
    else if (filterMode === 'OWNER') setFilterMode('PARTICIPANT');
    else setFilterMode('ALL');
  };

  const filteredProjects = projects.filter(p => {
    if (filterMode === 'ALL') return true;
    if (filterMode === 'OWNER') return p.myRole === 'OWNER';
    if (filterMode === 'PARTICIPANT') return p.myRole === 'EDITOR' || p.myRole === 'VIEWER';
    return true;
  });

  const currentCollabProject = projects.find(p => p.projectId === collabProjectId);
  const isCollabOwner = currentCollabProject?.myRole === 'OWNER';

  const meExists = collaborators.some(c => String(c.memberId) === String(userInfo.id));
  let rawMembers = [...collaborators];
  if (!meExists && currentCollabProject) {
    rawMembers.push({
      memberId: userInfo.id,
      nickname: userInfo.nickname,
      email: userInfo.email,
      role: (currentCollabProject.myRole as 'OWNER' | 'EDITOR' | 'VIEWER') || 'VIEWER',
      status: 'ACCEPTED'
    });
  }

  const processedMembers = rawMembers.map(c => ({
    ...c,
    isMe: String(c.memberId) === String(userInfo.id),
    email: c.email || ''
  }));

  const allMembers = processedMembers.sort((a, b) => {
    if (a.role === 'OWNER' && b.role !== 'OWNER') return -1;
    if (b.role === 'OWNER' && a.role !== 'OWNER') return 1;

    if (a.isMe && !b.isMe) return -1;
    if (b.isMe && !a.isMe) return 1;

    if (a.status === 'PENDING' && b.status !== 'PENDING') return 1;
    if (b.status === 'PENDING' && a.status !== 'PENDING') return -1;

    if (a.role === 'EDITOR' && b.role === 'VIEWER') return -1;
    if (b.role === 'EDITOR' && a.role === 'VIEWER') return 1;

    return a.nickname.localeCompare(b.nickname);
  });

  const filteredMembers = allMembers.filter(m => 
    m.nickname.toLowerCase().includes(collabSearchTerm.toLowerCase())
  );

  return (
    <PageContainer>
      <Header>
        <LogoArea>
          <img src={logo} alt="logo" width="36" height="36" style={{ borderRadius: '8px' }} />
          <BrandName>InfraGen</BrandName>
        </LogoArea>

        <UserInfo>
          <ProfileWrapper onClick={(e) => { 
            e.stopPropagation(); 
            setIsProfileMenuOpen(!isProfileMenuOpen); 
          }}>
            <Avatar>
              {userInfo.nickname.charAt(0).toUpperCase()}
            </Avatar>
            {invitations.length > 0 && <ProfileDotBadge />}

            {isProfileMenuOpen && (
              <ProfileDropdown onClick={(e) => e.stopPropagation()}>
                <ProfileAvatarLg style={{ cursor: 'default' }}>
                  {userInfo.nickname.charAt(0).toUpperCase()}
                </ProfileAvatarLg>
                <ProfileName>{userInfo.nickname}</ProfileName>
                <ProfileEmail>{userInfo.email}</ProfileEmail>

                <div style={{ width: '100%', borderBottom: '1px solid #e2e8f0', margin: '12px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '16px', padding: '0 4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#4a5568' }}>자동 저장 (10분)</span>
                  <ToggleSwitchContainer>
                    <ToggleInput type="checkbox" checked={isAutoSaveEnabled} onChange={(e) => setIsAutoSaveEnabled(e.target.checked)} />
                    <ToggleSlider checked={isAutoSaveEnabled} />
                  </ToggleSwitchContainer>
                </div>

                <ProfileActionRow style={{ marginBottom: '8px' }}>
                  <ProfileActionBtn 
                    style={{ position: 'relative' }} 
                    onClick={() => { setIsInviteModalOpen(true); setIsProfileMenuOpen(false); }}
                  >
                    초대 목록 {invitations.length > 0 && <BadgeIndicator>{invitations.length}</BadgeIndicator>}
                  </ProfileActionBtn>
                </ProfileActionRow>

                <ProfileActionRow>
                  <ProfileActionBtn onClick={handleOpenUserInfo}>회원정보</ProfileActionBtn>
                  <ProfileActionBtn className="danger" onClick={logout}>로그아웃</ProfileActionBtn>
                </ProfileActionRow>
              </ProfileDropdown>
            )}
          </ProfileWrapper>
        </UserInfo>
      </Header>

      <ContentArea>
        <ContentWrapper>
          <SectionHeader>
            <SectionTitle>내 프로젝트</SectionTitle>
            <HeaderActions>
              <FilterBtn onClick={handleFilterToggle}>
                {filterMode === 'ALL' ? '전체' : filterMode === 'OWNER' ? '방장' : '참여'}
              </FilterBtn>

              {projects.length > 0 && (
                <SelectModeBtn 
                  $active={isSelectMode} 
                  onClick={() => {
                    setIsSelectMode(!isSelectMode);
                    setSelectedIds([]);
                    setMenuOpenId(null);
                  }}
                >
                  {isSelectMode ? '선택 취소' : '항목 선택'}
                </SelectModeBtn>
              )}
              {isSelectMode && selectedIds.length > 0 && (
                <BulkDeleteBtn onClick={() => setIsBulkDeleteConfirmOpen(true)}>
                  {selectedIds.length}개 처리
                </BulkDeleteBtn>
              )}
              <CreateBtn onClick={() => {
                setNewTitle(''); setNewDesc(''); setModalProvider('LOCAL'); setModalMode('create');
              }}>+ 새 프로젝트</CreateBtn>
            </HeaderActions>
          </SectionHeader>

          {projects.length === 0 ? (
            <EmptyState>
              <p>아직 생성된 프로젝트가 없습니다.</p>
              <span>새 프로젝트를 생성하여 인프라 설계를 시작해보세요!</span>
            </EmptyState>
          ) : filteredProjects.length === 0 ? (
            <EmptyState>
              <p>해당 조건에 맞는 프로젝트가 없습니다.</p>
            </EmptyState>
          ) : (
            <Grid>
              {filteredProjects.map((proj) => {
                const isSelected = selectedIds.includes(proj.projectId);
                const isProjOwner = proj.myRole === 'OWNER';

                return (
                  <ProjectCard 
                    key={proj.projectId} 
                    onClick={() => {
                      if (isSelectMode) setSelectedIds(prev => prev.includes(proj.projectId) ? prev.filter(id => id !== proj.projectId) : [...prev, proj.projectId]);
                      else navigate(`/project/${proj.projectId}`);
                    }}
                    $isSelected={isSelected}
                    $isSelectMode={isSelectMode}
                  >
                    <CardHeader>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <RoleBadge $role={proj.myRole || 'VIEWER'}>{proj.myRole || 'VIEWER'}</RoleBadge>
                        <ProjectStatus $status={proj.status}>{proj.status}</ProjectStatus>
                      </div>

                      {isSelectMode ? (
                        <Checkbox $isChecked={isSelected}>
                          {isSelected && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          )}
                        </Checkbox>
                      ) : (
                        <KebabMenuWrapper 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setMenuOpenId(menuOpenId === proj.projectId ? null : proj.projectId); 
                          }}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="5" r="1.5"></circle>
                            <circle cx="12" cy="12" r="1.5"></circle>
                            <circle cx="12" cy="19" r="1.5"></circle>
                          </svg>

                          {menuOpenId === proj.projectId && (
                            <DropdownMenu>
                              <DropdownItem onClick={(e) => handleOpenEdit(e, proj)}>{isProjOwner ? '수정' : '정보'}</DropdownItem>

                              <DropdownItem onClick={(e) => handleOpenCollabModal(e, proj.projectId)}>참여자</DropdownItem>
                              <DropdownItem onClick={(e) => handleOpenHistory(e, proj.projectId)}>기록</DropdownItem>
                              <DropdownItem onClick={(e) => handleOpenCodeViewer(e, proj.projectId)}>코드</DropdownItem>

                              {isProjOwner ? (
                                <DropdownItem className="danger" onClick={(e) => handleDeleteSingle(e, proj.projectId)}>삭제</DropdownItem>
                              ) : (
                                <DropdownItem className="danger" onClick={(e) => handleLeaveSingle(e, proj.projectId)}>나가기</DropdownItem>
                              )}
                            </DropdownMenu>
                          )}
                        </KebabMenuWrapper>
                      )}
                    </CardHeader>
                    <ProjectTitle>{proj.title}</ProjectTitle>
                    <ProjectDesc>{proj.description || '설명이 없습니다.'}</ProjectDesc>
                    <CardFooter>
                      <span>생성일</span>
                      <span>{formatDate(proj.createdAt)}</span>
                    </CardFooter>
                  </ProjectCard>
                );
              })}
            </Grid>
          )}
        </ContentWrapper>
      </ContentArea>

      {modalMode !== null && (() => {
        const isEditingTargetOwner = modalMode === 'create' || projects.find(p => p.projectId === editTargetId)?.myRole === 'OWNER';

        return (
          <ModalOverlay onClick={() => { setModalMode(null); setIsProviderDropdownOpen(false); }}>
            <ModalContent onClick={(e) => e.stopPropagation()}>
              <ModalTitle>
                {modalMode === 'create' ? '새 프로젝트 생성' : (isEditingTargetOwner ? '프로젝트 수정' : '프로젝트 정보')}
              </ModalTitle>
              <form onSubmit={isEditingTargetOwner ? handleSubmitProject : (e) => e.preventDefault()}>
                <InputGroup>
                  <label>프로젝트 이름 및 클라우드 환경</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Input
                      autoFocus={isEditingTargetOwner}
                      placeholder="예: My E-commerce Infra"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      disabled={!isEditingTargetOwner}
                      style={{ 
                        flex: 1, 
                        cursor: !isEditingTargetOwner ? 'not-allowed' : 'text', 
                        backgroundColor: !isEditingTargetOwner ? '#f8f9fa' : 'white', 
                        color: !isEditingTargetOwner ? '#718096' : 'inherit' 
                      }}
                    />

                    <div style={{ position: 'relative', width: '90px' }}>
                      <div
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          if (!isEditingTargetOwner) return;
                          setIsProviderDropdownOpen(!isProviderDropdownOpen); 
                        }}
                        style={{ 
                          display:'flex', justifyContent:'space-between', alignItems: 'center', 
                          padding:'10px 12px', background: !isEditingTargetOwner ? '#f8f9fa' : 'white', 
                          border:'1px solid #e2e8f0', borderRadius:'8px', fontSize:'13px', fontWeight:600, 
                          color: !isEditingTargetOwner ? '#718096' : (modalProvider ? '#4a5568' : '#a0aec0'), 
                          cursor: isEditingTargetOwner ? 'pointer' : 'not-allowed', 
                          opacity: isEditingTargetOwner ? 1 : 0.8, 
                          transition: '0.2s', height: '100%', boxSizing: 'border-box' 
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {modalProvider === 'LOCAL' ? 'LOCAL' : modalProvider}
                        </span>
                        <span style={{ fontSize: '10px', transform: isProviderDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s', marginLeft: '4px', flexShrink: 0 }}>▼</span>
                      </div>

                      {isProviderDropdownOpen && isEditingTargetOwner && (
                        <div style={{ position:'absolute', top:'100%', left:0, width:'100%', background:'white', border:'1px solid #e2e8f0', borderRadius:'8px', boxShadow:'0 4px 12px rgba(0,0,0,0.1)', zIndex:100, marginTop:'6px', overflow:'hidden' }}>
                          <div 
                            onClick={() => { setModalProvider('LOCAL'); setIsProviderDropdownOpen(false); }} 
                            style={{ padding:'10px 12px', fontSize:'13px', cursor:'pointer', color: modalProvider === 'LOCAL' ? '#28b4ad' : '#2d3748', fontWeight: modalProvider === 'LOCAL' ? 'bold' : 'normal', borderBottom: '1px solid #edf2f7', transition: '0.2s' }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#f8f9fa'} 
                            onMouseOut={(e) => e.currentTarget.style.background = 'white'}
                          >LOCAL</div>
                          <div 
                            onClick={() => { setModalProvider('AWS'); setIsProviderDropdownOpen(false); }} 
                            style={{ padding:'10px 12px', fontSize:'13px', cursor:'pointer', color: modalProvider === 'AWS' ? '#28b4ad' : '#2d3748', fontWeight: modalProvider === 'AWS' ? 'bold' : 'normal', borderBottom: '1px solid #edf2f7', transition: '0.2s' }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#f8f9fa'} 
                            onMouseOut={(e) => e.currentTarget.style.background = 'white'}
                          >AWS</div>
                          <div 
                            onClick={() => { setModalProvider('OCI'); setIsProviderDropdownOpen(false); }} 
                            style={{ padding:'10px 12px', fontSize:'13px', cursor:'pointer', color: modalProvider === 'OCI' ? '#28b4ad' : '#2d3748', fontWeight: modalProvider === 'OCI' ? 'bold' : 'normal', transition: '0.2s' }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#f8f9fa'} 
                            onMouseOut={(e) => e.currentTarget.style.background = 'white'}
                          >OCI</div>
                        </div>
                      )}
                    </div>
                  </div>
                </InputGroup>
                <InputGroup>
                  <label>설명 (선택)</label>
                  <TextArea 
                    placeholder="간단한 설명을 적어주세요." 
                    value={newDesc} 
                    onChange={(e) => setNewDesc(e.target.value)} 
                    disabled={!isEditingTargetOwner}
                    style={{ 
                      cursor: !isEditingTargetOwner ? 'not-allowed' : 'text', 
                      backgroundColor: !isEditingTargetOwner ? '#f8f9fa' : 'white', 
                      color: !isEditingTargetOwner ? '#718096' : 'inherit' 
                    }}
                  />
                </InputGroup>
                <ModalActions style={{ justifyContent: 'flex-end', gap: '10px' }}>
                  {isEditingTargetOwner ? (
                    <>
                      <CancelBtn type="button" onClick={() => setModalMode(null)}>취소</CancelBtn>
                      <SubmitBtn type="submit">{modalMode === 'create' ? '생성하기' : '수정하기'}</SubmitBtn>
                    </>
                  ) : (
                    <CancelBtn type="button" onClick={() => setModalMode(null)}>닫기</CancelBtn>
                  )}
                </ModalActions>
              </form>
            </ModalContent>
          </ModalOverlay>
        );
      })()}

      {isUserInfoModalOpen && (
        <ModalOverlay onClick={() => setIsUserInfoModalOpen(false)}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalTitle>회원정보 관리</ModalTitle>
            <form onSubmit={handleUpdateUserInfo}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                <ProfileAvatarLg style={{ marginBottom: 0, width: '80px', height: '80px', cursor: 'default' }}>
                  {editProfileForm.nickname.charAt(0).toUpperCase() || '?'}
                </ProfileAvatarLg>
              </div>

              <InputGroup>
                <label>내 초대 코드 (초대 시 사용)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Input type="text" value={userInfo.inviteCode} readOnly style={{ flex: 1, background: '#f1f3f5', color: '#718096', fontWeight: 'bold' }} />
                  <CancelBtn type="button" onClick={() => copyToClipboard(String(userInfo.inviteCode))} style={{ flexShrink: 0 }}>복사</CancelBtn>
                </div>
              </InputGroup>

              <InputGroup>
                <label>닉네임</label>
                <Input type="text" required value={editProfileForm.nickname} onChange={(e) => setEditProfileForm({ ...editProfileForm, nickname: e.target.value })} />
              </InputGroup>
              <InputGroup>
                <label>이메일 (변경 불가)</label>
                <Input type="email" value={userInfo.email} disabled />
              </InputGroup>

              {userInfo.provider !== 'KAKAO' && (
                <>
                  <InputGroup>
                    <label>새 비밀번호</label>
                    <Input type="password" placeholder="변경할 비밀번호 (선택사항, 8자 이상)" value={editProfileForm.password} onChange={(e) => setEditProfileForm({ ...editProfileForm, password: e.target.value })} />
                  </InputGroup>
                  <InputGroup style={{ opacity: editProfileForm.password ? 1 : 0.4, transition: '0.2s' }}>
                    <label>새 비밀번호 확인</label>
                    <Input type="password" placeholder="비밀번호 재입력" value={editProfileForm.passwordConfirm} onChange={(e) => setEditProfileForm({ ...editProfileForm, passwordConfirm: e.target.value })} disabled={!editProfileForm.password} />
                  </InputGroup>
                </>
              )}

              <ModalActions style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
                <WithdrawBtn type="button" onClick={() => setIsWithdrawConfirmOpen(true)}>회원 탈퇴</WithdrawBtn>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <CancelBtn type="button" onClick={() => setIsUserInfoModalOpen(false)}>취소</CancelBtn>
                  <SubmitBtn type="submit">{hasProfileChanges ? '저장하기' : '확인'}</SubmitBtn>
                </div>
              </ModalActions>
            </form>
          </ModalContent>
        </ModalOverlay>
      )}

      {isInviteModalOpen && (
        <ModalOverlay onClick={() => setIsInviteModalOpen(false)}>
          <ModalContent onClick={e => e.stopPropagation()} style={{ width: '400px' }}>
            <ModalTitle>받은 초대 목록</ModalTitle>
            <div style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
              {invitations.length === 0 ? (
                <EmptyState style={{ padding: '40px 0', border: 'none', background: '#f8f9fa' }}>새로운 초대가 없습니다.</EmptyState>
              ) : (
                invitations.map(inv => (
                  <InviteItem key={inv.invitationId}>
                    <div className="info">
                      <div className="proj-title">{inv.projectTitle}</div>
                      <div className="inviter">초대자: {inv.inviterNickname}</div>
                    </div>
                    <div className="actions">
                      <button className="accept" onClick={() => handleAcceptInvite(inv.invitationId)}>수락</button>
                      <button className="reject" onClick={() => handleRejectInvite(inv.invitationId)}>거절</button>
                    </div>
                  </InviteItem>
                ))
              )}
            </div>
            <ModalActions style={{ justifyContent: 'flex-end', marginTop: '20px' }}>
              <CancelBtn onClick={() => setIsInviteModalOpen(false)}>닫기</CancelBtn>
            </ModalActions>
          </ModalContent>
        </ModalOverlay>
      )}

      {isCollabModalOpen && (
        <ModalOverlay onClick={() => setIsCollabModalOpen(false)}>
          <ModalContent onClick={(e) => e.stopPropagation()} style={{ width: '420px', padding: 0, overflow: 'hidden' }}>
            <TabContainer>
              <CollabTab $active={collabTab === 'list'} onClick={() => setCollabTab('list')}>참여자 목록</CollabTab>
              {isCollabOwner && (
                <CollabTab $active={collabTab === 'invite'} onClick={() => setCollabTab('invite')}>직접 초대하기</CollabTab>
              )}
            </TabContainer>

            <div style={{ padding: '24px', height: '280px', display: 'flex', flexDirection: 'column' }}>
              {collabTab === 'invite' && isCollabOwner ? (
                <form onSubmit={handleInviteMember} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ flex: 1 }}>
                    <InputGroup>
                      <label>초대 코드 (초대할 회원의 코드 입력)</label>
                      <Input 
                        type="text" 
                        placeholder="상대방의 초대 코드를 입력하세요" 
                        value={inviteCode} 
                        onChange={(e) => setInviteCode(e.target.value)} 
                      />
                    </InputGroup>
                    <InputGroup>
                      <label>부여할 권한</label>
                      <div style={{ position: 'relative', width: '100%' }}>
                        <div
                          onClick={(e) => { e.stopPropagation(); setOpenInviteRoleDropdown(!openInviteRoleDropdown); }}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: '#4a5568', cursor: 'pointer' }}
                        >
                          <span>{inviteRole === 'EDITOR' ? 'EDITOR (수정 가능)' : 'VIEWER (조회 가능)'}</span>
                          <span style={{ fontSize: '10px', transform: openInviteRoleDropdown ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s' }}>▼</span>
                        </div>
                        {openInviteRoleDropdown && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, marginTop: '4px', overflow: 'hidden' }}>
                            <div 
                              onClick={() => { setInviteRole('EDITOR'); setOpenInviteRoleDropdown(false); }} 
                              style={{ padding: '12px', fontSize: '14px', cursor: 'pointer', borderBottom: '1px solid #edf2f7' }}
                              onMouseOver={(e) => e.currentTarget.style.background = '#f8f9fa'} 
                              onMouseOut={(e) => e.currentTarget.style.background = 'white'}
                            >EDITOR (수정 가능)</div>
                            <div 
                              onClick={() => { setInviteRole('VIEWER'); setOpenInviteRoleDropdown(false); }} 
                              style={{ padding: '12px', fontSize: '14px', cursor: 'pointer' }}
                              onMouseOver={(e) => e.currentTarget.style.background = '#f8f9fa'} 
                              onMouseOut={(e) => e.currentTarget.style.background = 'white'}
                            >VIEWER (조회 가능)</div>
                          </div>
                        )}
                      </div>
                    </InputGroup>
                  </div>

                  <ModalActions style={{ marginTop: 'auto' }}>
                    <SubmitBtn type="submit" style={{ width: '100%' }}>초대하기</SubmitBtn>
                  </ModalActions>
                </form>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexShrink: 0 }}>
                    <Input 
                      type="text" 
                      placeholder="닉네임 검색" 
                      value={collabSearchTerm} 
                      onChange={(e) => setCollabSearchTerm(e.target.value)} 
                      style={{ flex: 1, padding: '8px 12px', fontSize: '13px' }}
                    />
                    {isCollabOwner && (
                      <FilterBtn onClick={() => setIsCollabEditMode(!isCollabEditMode)} style={{ padding: '8px 16px' }}>
                        {isCollabEditMode ? '완료' : '편집'}
                      </FilterBtn>
                    )}
                  </div>

                  <CollabListWrapper>
                    {filteredMembers.length === 0 ? (
                      <EmptyState style={{ padding: '30px 0', border: 'none', background: 'transparent' }}>
                        <p style={{ fontSize: '14px' }}>검색 결과가 없습니다.</p>
                      </EmptyState>
                    ) : (
                      filteredMembers.map(member => (
                        <CollabItem key={member.memberId} $isMe={member.isMe}>
                          <div className="user-info">
                            <span className="avatar" style={member.isMe ? { background: '#28b4ad', color: 'white' } : {}}>
                              {member.nickname.charAt(0).toUpperCase()}
                            </span>
                            <div className="details">
                              <span className="name-wrapper">
                                <span className="name-text">{member.nickname}</span>
                              </span>
                              <span className="email">{member.email || (typeof member.memberId === 'string' && member.memberId.startsWith('inv-') ? '응답 대기 중' : `ID: ${member.memberId}`)}</span>
                            </div>
                          </div>

                          <div className="actions">
                            {member.status === 'PENDING' ? (
                              <PendingBadge onClick={() => handleRemoveCollaborator(member.memberId)}>
                                <span className="default-text">수락대기</span>
                                <span className="hover-text">초대취소</span>
                              </PendingBadge>
                            ) : !isCollabEditMode || member.isMe ? (
                              <span className={`role-text ${member.role.toLowerCase()}`}>{member.role}</span>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ position: 'relative' }}>
                                  <div
                                    onClick={(e) => { e.stopPropagation(); setOpenRoleDropdownId(openRoleDropdownId === member.memberId ? null : member.memberId); }}
                                    style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', padding: '4px 8px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '11px', fontWeight: 600, color: '#4a5568', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                  >
                                    <span>{member.role}</span>
                                    <span style={{ fontSize: '8px' }}>▼</span>
                                  </div>
                                  {openRoleDropdownId === member.memberId && (
                                    <div style={{ position: 'absolute', top: '100%', right: 0, minWidth: '100%', background: 'white', border: '1px solid #e2e8f0', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, marginTop: '2px', overflow: 'hidden' }}>
                                      <div 
                                        onClick={() => { handleRoleChange(member.memberId, 'EDITOR'); setOpenRoleDropdownId(null); }} 
                                        style={{ padding: '6px 12px', fontSize: '11px', cursor: 'pointer', borderBottom: '1px solid #edf2f7', textAlign: 'center' }}
                                        onMouseOver={(e) => e.currentTarget.style.background = '#f8f9fa'} 
                                        onMouseOut={(e) => e.currentTarget.style.background = 'white'}
                                      >EDITOR</div>
                                      <div 
                                        onClick={() => { handleRoleChange(member.memberId, 'VIEWER'); setOpenRoleDropdownId(null); }} 
                                        style={{ padding: '6px 12px', fontSize: '11px', cursor: 'pointer', textAlign: 'center' }}
                                        onMouseOver={(e) => e.currentTarget.style.background = '#f8f9fa'} 
                                        onMouseOut={(e) => e.currentTarget.style.background = 'white'}
                                      >VIEWER</div>
                                    </div>
                                  )}
                                </div>
                                <button className="remove-btn" onClick={() => handleRemoveCollaborator(member.memberId)}>퇴출</button>
                              </div>
                            )}
                          </div>
                        </CollabItem>
                      ))
                    )}
                  </CollabListWrapper>
                </>
              )}
            </div>
          </ModalContent>
        </ModalOverlay>
      )}

      {collaboratorToRemove !== null && (
        <ModalOverlay onClick={() => setCollaboratorToRemove(null)} style={{ zIndex: 1100 }}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalTitle style={{ color: '#e53e3e', fontSize: '18px' }}>
              {typeof collaboratorToRemove === 'string' && collaboratorToRemove.startsWith('inv-') ? '초대 취소' : '참여자 퇴출'}
            </ModalTitle>
            <p style={{ color: '#4a5568', fontSize: '14px', lineHeight: '1.6', margin: '0 0 24px 0' }}>
              {typeof collaboratorToRemove === 'string' && collaboratorToRemove.startsWith('inv-')
                ? '이 사용자에게 보낸 초대를 취소하시겠습니까?'
                : '정말 이 참여자를 프로젝트에서 퇴출하시겠습니까?'}
            </p>
            <ModalActions style={{ justifyContent: 'flex-end', gap: '10px', marginTop: 0 }}>
              <CancelBtn type="button" onClick={() => setCollaboratorToRemove(null)}>닫기</CancelBtn>
              <SubmitBtn type="button" style={{ background: '#e53e3e' }} onClick={confirmRemoveCollaborator}>
                {typeof collaboratorToRemove === 'string' && collaboratorToRemove.startsWith('inv-') ? '초대취소' : '퇴출하기'}
              </SubmitBtn>
            </ModalActions>
          </ModalContent>
        </ModalOverlay>
      )}

      {isHistoryModalOpen && (
        <ModalOverlay onClick={() => setIsHistoryModalOpen(false)}>
          <HistoryModalContent onClick={(e) => e.stopPropagation()}>
            <HistoryHeaderRow>
              <ModalTitle style={{ marginBottom: 0 }}>활동 기록</ModalTitle>
              <SortToggleBtn onClick={() => setHistorySortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}>
                {historySortOrder === 'desc' ? '정렬: 최신순 ▼' : '정렬: 오래된순 ▲'}
              </SortToggleBtn>
            </HistoryHeaderRow>

            <HistoryListWrapper>
              {isHistoryLoading ? (
                <EmptyHistory>로딩중...</EmptyHistory>
              ) : sortedHistory.length === 0 ? (
                <EmptyHistory>아직 저장된 활동 기록이 없습니다.<br />(에디터에서 수정 후 저장하거나 코드를 생성해보세요)</EmptyHistory>
              ) : (
                sortedHistory.map((h) => {
                  const logLines = h.description ? h.description.split('\n') : ['인프라 코드가 생성되었습니다.'];
                  return (
                    <HistoryItemCard key={h.historyId}>
                      <HistoryItemHeader>
                        <HistoryDate>{formatDateTime(h.createdAt)}</HistoryDate>
                      </HistoryItemHeader>
                      <HistoryDescList>
                        {logLines.map((line: string, i: number) => (
                          <li key={i}>{line}</li>
                        ))}
                      </HistoryDescList>
                    </HistoryItemCard>
                  );
                })
              )}
            </HistoryListWrapper>
            <ModalActions style={{ marginTop: '20px', justifyContent: 'flex-end' }}>
              <CancelBtn style={{ width: '100%' }} onClick={() => setIsHistoryModalOpen(false)}>닫기</CancelBtn>
            </ModalActions>
          </HistoryModalContent>
        </ModalOverlay>
      )}

      {isCodeViewerOpen && (
        <ModalOverlay onClick={() => setIsCodeViewerOpen(false)}>
          <CodeViewerModal onClick={(e) => e.stopPropagation()}>
            <CVHeader>
              <ModalTitle style={{ margin: 0 }}>생성된 코드 뷰어</ModalTitle>
              <div style={{ display: 'flex', gap: '10px' }}>
                <CloseBtn onClick={() => setIsCodeViewerOpen(false)}>✕</CloseBtn>
              </div>
            </CVHeader>

            <CVBody>
              <CVLeftSidebar>
                <CVSectionTitle>파일 목록</CVSectionTitle>
                <CVFileList>
                  {codeViewerFiles.map(file => {
                    const isViewing = selectedViewFile?.fileId === file.fileId;

                    return (
                      <CVFileItem 
                        key={file.fileId} 
                        $isViewing={isViewing}
                        onClick={() => {
                          setSelectedViewFile(file);
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', overflow: 'hidden' }}>
                          <span style={{ fontSize: '10px', color: '#a0aec0', marginBottom: '2px', opacity: 0.8 }}>{file.folderName}</span>
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{file.fileName}</span>
                        </div>
                      </CVFileItem>
                    );
                  })}
                </CVFileList>
              </CVLeftSidebar>

              <CVRightArea>
                {selectedViewFile ? (
                  <>
                    <CVSectionTitle>포함된 노드 설정</CVSectionTitle>
                    <CVAssignedNodes>
                      {codeViewerNodes
                        .filter(n => n.properties?.fileName === selectedViewFile.folderName)
                        .map(n => (
                          <CVNodeBadge key={n.id}>
                            <span className="type">{n.componentType}</span>
                            <span className="name">{n.nodeName}</span>
                          </CVNodeBadge>
                      ))}
                      {codeViewerNodes.filter(n => n.properties?.fileName === selectedViewFile.folderName).length === 0 && (
                        <span style={{ fontSize: 12, color: '#a0aec0' }}>이 파일에 매핑된 노드가 없습니다.</span>
                      )}
                    </CVAssignedNodes>

                    <CVSectionTitle>코드 내용</CVSectionTitle>
                    <CVCodeContainer>
                      <div style={{ fontWeight: 'bold', color: '#2d3748', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px dashed #e2e8f0' }}>
                        {selectedViewFile.fileName}
                      </div>
                      {selectedViewFile.content}
                    </CVCodeContainer>
                  </>
                ) : (
                  <EmptyHistory>선택된 파일이 없습니다.</EmptyHistory>
                )}
              </CVRightArea>
            </CVBody>
          </CodeViewerModal>
        </ModalOverlay>
      )}

      {projectToDelete !== null && (
        <ModalOverlay onClick={() => setProjectToDelete(null)} style={{ zIndex: 1100 }}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalTitle style={{ color: '#e53e3e', fontSize: '18px' }}>프로젝트 삭제</ModalTitle>
            <p style={{ color: '#4a5568', fontSize: '14px', lineHeight: '1.6', margin: '0 0 24px 0' }}>
              정말 이 프로젝트를 삭제하시겠습니까?<br />
              삭제된 프로젝트의 모든 데이터는 복구할 수 없습니다.
            </p>
            <ModalActions style={{ justifyContent: 'flex-end', gap: '10px', marginTop: 0 }}>
              <CancelBtn type="button" onClick={() => setProjectToDelete(null)}>취소</CancelBtn>
              <SubmitBtn type="button" style={{ background: '#e53e3e' }} onClick={confirmDeleteSingle}>삭제하기</SubmitBtn>
            </ModalActions>
          </ModalContent>
        </ModalOverlay>
      )}

      {projectToLeave !== null && (
        <ModalOverlay onClick={() => setProjectToLeave(null)} style={{ zIndex: 1100 }}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalTitle style={{ color: '#e53e3e', fontSize: '18px' }}>프로젝트 나가기</ModalTitle>
            <p style={{ color: '#4a5568', fontSize: '14px', lineHeight: '1.6', margin: '0 0 24px 0' }}>
              정말 이 프로젝트에서 나가시겠습니까?<br />
              다시 참여하려면 권한자의 초대가 필요합니다.
            </p>
            <ModalActions style={{ justifyContent: 'flex-end', gap: '10px', marginTop: 0 }}>
              <CancelBtn type="button" onClick={() => setProjectToLeave(null)}>취소</CancelBtn>
              <SubmitBtn type="button" style={{ background: '#e53e3e' }} onClick={confirmLeaveSingle}>나가기</SubmitBtn>
            </ModalActions>
          </ModalContent>
        </ModalOverlay>
      )}

      {isBulkDeleteConfirmOpen && (
        <ModalOverlay onClick={() => setIsBulkDeleteConfirmOpen(false)} style={{ zIndex: 1100 }}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalTitle style={{ color: '#e53e3e', fontSize: '18px' }}>선택 항목 처리</ModalTitle>
            <p style={{ color: '#4a5568', fontSize: '14px', lineHeight: '1.6', margin: '0 0 24px 0' }}>
              선택한 {selectedIds.length}개의 프로젝트를 처리하시겠습니까?<br />
              (생성한 프로젝트는 삭제되고, 참여 중인 프로젝트는 나가기 처리됩니다.)
            </p>
            <ModalActions style={{ justifyContent: 'flex-end', gap: '10px', marginTop: 0 }}>
              <CancelBtn type="button" onClick={() => setIsBulkDeleteConfirmOpen(false)}>취소</CancelBtn>
              <SubmitBtn type="button" style={{ background: '#e53e3e' }} onClick={confirmBulkDelete}>확인</SubmitBtn>
            </ModalActions>
          </ModalContent>
        </ModalOverlay>
      )}

      {isWithdrawConfirmOpen && (
        <ModalOverlay onClick={() => setIsWithdrawConfirmOpen(false)} style={{ zIndex: 1100 }}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalTitle style={{ color: '#e53e3e', fontSize: '18px' }}>회원 탈퇴를 진행하시겠습니까?</ModalTitle>
            <p style={{ color: '#4a5568', fontSize: '14px', lineHeight: '1.6', margin: '0 0 24px 0' }}>
              탈퇴 시 생성된 모든 프로젝트와 계정 정보가 완전히 삭제되며, 삭제된 데이터는 다시 복구할 수 없습니다.
            </p>
            <ModalActions style={{ justifyContent: 'flex-end', gap: '10px', marginTop: 0 }}>
              <CancelBtn type="button" onClick={() => setIsWithdrawConfirmOpen(false)}>취소</CancelBtn>
              <SubmitBtn type="button" style={{ background: '#e53e3e' }} onClick={executeWithdraw}>탈퇴 확인</SubmitBtn>
            </ModalActions>
          </ModalContent>
        </ModalOverlay>
      )}

      {toastMessage && <ToastNotification>{toastMessage}</ToastNotification>}
    </PageContainer>
  );
}

const ProfileDotBadge = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  width: 10px;
  height: 10px;
  background-color: #e53e3e;
  border-radius: 50%;
  border: 2px solid white;
`;

const PendingBadge = styled.div`
  font-size: 12px;
  font-weight: 700;
  color: #d69e2e;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: 0.2s;
  text-align: center;

  .hover-text { display: none; }

  &:hover {
    background: #fff5f5;
    color: #e53e3e;
    .default-text { display: none; }
    .hover-text { display: inline; }
  }
`;

const PageContainer = styled.div`
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f8fafd;
  font-family: 'Inter', 'Pretendard', sans-serif;
`;

const Header = styled.header`
  height: 60px;
  background: white;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  flex-shrink: 0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.02);
`;

const LogoArea = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const BrandName = styled.h1`
  font-size: 20px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
`;

const UserInfo = styled.div`
  display: flex;
  align-items: center;
`;

const ProfileWrapper = styled.div`
  position: relative;
  cursor: pointer;
`;

const Avatar = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #28b4ad;
  color: white;
  font-weight: 700;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 2px 8px rgba(40, 180, 173, 0.3);
  }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const ProfileDropdown = styled.div`
  position: absolute;
  top: 70px; 
  right: 0;
  width: 240px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  z-index: 200;
  overflow: hidden;
  animation: ${fadeIn} 0.15s ease-out forwards;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 20px 20px;
`;

const ProfileAvatarLg = styled.div`
  width: 68px;
  height: 68px;
  border-radius: 50%;
  background: #28b4ad;
  color: white;
  font-weight: 700;
  font-size: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
`;

const ProfileName = styled.span`
  font-size: 18px;
  font-weight: 700;
  color: #2d3748;
  margin-bottom: 4px;
  text-align: center;
`;

const ProfileEmail = styled.span`
  font-size: 13px;
  color: #718096;
  margin-bottom: 12px;
  text-align: center;
  word-break: break-all;
  width: 100%;
`;

const ToggleSwitchContainer = styled.label`
  display: flex;
  align-items: center;
  cursor: pointer;
`;

const ToggleInput = styled.input`
  display: none;
`;

const ToggleSlider = styled.div<{ checked: boolean }>`
  width: 36px;
  height: 20px;
  background-color: ${({ checked }) => (checked ? '#28b4ad' : '#cbd5e0')};
  border-radius: 20px;
  position: relative;
  transition: 0.3s;
  &::after {
    content: '';
    position: absolute;
    top: 2px;
    left: ${({ checked }) => (checked ? '18px' : '2px')};
    width: 16px;
    height: 16px;
    background-color: white;
    border-radius: 50%;
    transition: 0.3s;
  }
`;

const ProfileActionRow = styled.div`
  display: flex;
  gap: 10px;
  width: 100%;
`;

const ProfileActionBtn = styled.button`
  flex: 1;
  padding: 10px 0;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: 0.2s;
  border: 1px solid #e2e8f0;
  background: white;
  color: #4a5568;

  &:hover { background: #f8f9fa; }
  &.danger {
    color: #e53e3e;
    &:hover { background: #fff5f5; border-color: #fc8181; }
  }
`;

const BadgeIndicator = styled.span`
  position: absolute;
  top: -6px;
  right: -6px;
  background: #e53e3e;
  color: white;
  font-size: 10px;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 10px;
`;

const ContentArea = styled.main`
  flex: 1;
  overflow-y: auto;
  padding: 40px;
`;

const ContentWrapper = styled.div`
  max-width: 1200px;
  margin: 0 auto;
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
`;

const SectionTitle = styled.h2`
  font-size: 24px;
  color: #1a1a1a;
  margin: 0;
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
`;

const FilterBtn = styled.button`
  background: white;
  color: #4a5568;
  border: 1px solid #cbd5e0;
  padding: 10px 16px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: 0.2s;
  display: flex;
  align-items: center;
  &:hover { background: #f8f9fa; border-color: #a0aec0; }
`;

const SelectModeBtn = styled.button<{ $active: boolean }>`
  background: ${({ $active }) => $active ? '#edf2f7' : 'white'};
  color: #4a5568;
  border: 1px solid #cbd5e0;
  padding: 10px 16px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: 0.2s;
  &:hover { background: #e2e8f0; }
`;

const BulkDeleteBtn = styled.button`
  background: #fff5f5;
  color: #e53e3e;
  border: 1px solid #fc8181;
  padding: 10px 16px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: 0.2s;
  animation: ${fadeIn} 0.2s ease-out;
  &:hover { background: #fed7d7; }
`;

const CreateBtn = styled.button`
  background: #28b4ad;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: 0.2s;
  box-shadow: 0 4px 12px rgba(40, 180, 173, 0.2);
  &:hover { background: #219992; transform: translateY(-2px); }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 80px 0;
  background: white;
  border-radius: 12px;
  border: 1px dashed #cbd5e0;
  color: #718096;

  p { font-size: 18px; font-weight: 600; margin: 0 0 8px 0; color: #4a5568; }
  span { font-size: 14px; }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
  padding-bottom: 40px; 
`;

const ProjectCard = styled.div<{ $isSelected: boolean; $isSelectMode: boolean }>`
  background: white;
  border-radius: 12px;
  padding: 20px;
  border: 2px solid ${({ $isSelected }) => $isSelected ? '#28b4ad' : '#e2e8f0'};
  box-shadow: 0 4px 6px rgba(0,0,0,0.02);
  cursor: pointer;
  transition: all 0.2s;
  animation: ${fadeIn} 0.3s ease-out;
  display: flex;
  flex-direction: column;
  position: relative;

  ${({ $isSelected }) => $isSelected && css`background: #f0fdfc;`}

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 10px 20px rgba(0,0,0,0.06);
    ${({ $isSelectMode, $isSelected }) => !$isSelectMode && !$isSelected && css`border-color: #28b4ad;`}
  }
`;

const Checkbox = styled.div<{ $isChecked: boolean }>`
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid ${({ $isChecked }) => $isChecked ? '#28b4ad' : '#cbd5e0'};
  background: ${({ $isChecked }) => $isChecked ? '#28b4ad' : 'white'};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: 0.15s;
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  min-height: 24px;
`;

const ProjectStatus = styled.span<{ $status: string }>`
  font-size: 11px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 6px;
  background: ${({ $status }) => $status === 'DRAFT' ? '#edf2f7' : '#e6fffa'};
  color: ${({ $status }) => $status === 'DRAFT' ? '#4a5568' : '#234e52'};
`;

const RoleBadge = styled.span<{ $role: string }>`
  font-size: 11px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 6px;
  background: ${({ $role }) => $role === 'OWNER' ? '#feebc8' : $role === 'EDITOR' ? '#e9d8fd' : '#e2e8f0'};
  color: ${({ $role }) => $role === 'OWNER' ? '#c05621' : $role === 'EDITOR' ? '#553c9a' : '#4a5568'};
`;

const KebabMenuWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  color: #a0aec0;
  transition: 0.2s;

  &:hover { background: #edf2f7; color: #4a5568; }
`;

const DropdownMenu = styled.div`
  position: absolute;
  top: 32px;
  right: 0;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  width: 140px;
  z-index: 100;
  overflow: hidden;
  animation: ${fadeIn} 0.15s ease-out forwards;
`;

const DropdownItem = styled.div`
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  color: #4a5568;
  transition: 0.15s;

  &:hover { background: #f8f9fa; }
  &.danger { color: #e53e3e; &:hover { background: #fff5f5; } }
`;

const ProjectTitle = styled.h3`
  font-size: 18px;
  margin: 0 0 8px 0;
  color: #2d3748;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ProjectDesc = styled.p`
  font-size: 13px;
  color: #718096;
  margin: 0 0 20px 0;
  line-height: 1.5;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const CardFooter = styled.div`
  display: flex;
  justify-content: space-between;
  border-top: 1px solid #edf2f7;
  padding-top: 12px;
  font-size: 12px;
  color: #a0aec0;
  font-weight: 500;
`;

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: white;
  width: 400px;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.15);
  animation: ${fadeIn} 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
`;

const ModalTitle = styled.h3`
  margin: 0 0 24px 0;
  font-size: 20px;
  color: #1a1a1a;
`;

const InputGroup = styled.div`
  margin-bottom: 20px;
  label { display: block; font-size: 13px; font-weight: 600; color: #4a5568; margin-bottom: 8px; }
`;

const Input = styled.input`
  width: 100%;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
  &:focus { outline: none; border-color: #28b4ad; box-shadow: 0 0 0 3px rgba(40,180,173,0.1); }
  &:disabled { background: #f8f9fa; cursor: not-allowed; }
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  height: 80px;
  resize: none;
  box-sizing: border-box;
  font-family: inherit;
  &:focus { outline: none; border-color: #28b4ad; box-shadow: 0 0 0 3px rgba(40,180,173,0.1); }
  &:disabled { background: #f8f9fa; cursor: not-allowed; }
`;

const ModalActions = styled.div`
  display: flex;
  margin-top: 30px;
`;

const WithdrawBtn = styled.button`
  background: none;
  color: #a0aec0;
  border: none;
  font-size: 13px;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
  padding: 10px 0;
  transition: color 0.2s;
  &:hover { color: #e53e3e; }
`;

const CancelBtn = styled.button`
  background: #edf2f7;
  color: #4a5568;
  border: none;
  padding: 10px 16px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  &:hover { background: #e2e8f0; }
`;

const SubmitBtn = styled.button`
  background: #28b4ad;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  &:hover { background: #219992; }
`;

const TabContainer = styled.div`
  display: flex;
  background: #f8f9fa;
  border-bottom: 1px solid #e2e8f0;
`;

const CollabTab = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: 14px 0;
  background: none;
  border: none;
  font-size: 14px;
  font-weight: 600;
  color: ${({ $active }) => $active ? '#28b4ad' : '#718096'};
  border-bottom: 2px solid ${({ $active }) => $active ? '#28b4ad' : 'transparent'};
  cursor: pointer;
  transition: 0.2s;
  &:hover { background: ${({ $active }) => $active ? 'transparent' : '#edf2f7'}; }
`;

const CollabListWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1; 
  overflow-y: auto;
  overflow-x: hidden;
  -ms-overflow-style: none;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
`;

const CollabItem = styled.div<{ $isMe?: boolean }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border: 1px solid ${({ $isMe }) => $isMe ? '#28b4ad' : '#e2e8f0'};
  background: ${({ $isMe }) => $isMe ? '#f0fdfc' : 'white'};
  border-radius: 8px;

  .user-info { 
    display: flex; 
    align-items: center; 
    gap: 12px; 
    flex: 1; 
    min-width: 0; 
    margin-right: 12px; 
  }
  .avatar { 
    width: 36px; height: 36px; 
    background: #edf2f7; color: #4a5568; 
    border-radius: 50%; 
    display: flex; align-items: center; justify-content: center; 
    font-weight: bold; font-size: 14px; 
    flex-shrink: 0;
  }
  .details { 
    display: flex; flex-direction: column; gap: 2px; 
    flex: 1; min-width: 0; 
  }
  .name-wrapper { 
    display: flex; align-items: center; gap: 4px; 
    width: 100%; min-width: 0; 
  }
  .name-text { 
    font-weight: bold; color: #2d3748; font-size: 14px; 
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; 
  }
  .email { 
    color: #a0aec0; font-size: 12px; 
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; 
  }

  .actions { 
    display: flex; flex-direction: row; align-items: center; justify-content: flex-end; gap: 8px; 
    flex-shrink: 0; 
  }

  .role-text { font-size: 12px; font-weight: 700; margin-top: 0; }
  .role-text.owner { color: #c05621; }
  .role-text.editor { color: #553c9a; }
  .role-text.viewer { color: #718096; }
  .role-text.pending { color: #d69e2e; }

  .remove-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #fff5f5;
    border: 1px solid #fc8181;
    color: #e53e3e;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    padding: 4px 10px;
    border-radius: 4px;
    transition: 0.2s;
    white-space: nowrap;
  }
  .remove-btn:hover { background: #fed7d7; }
`;

const InviteItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  margin-bottom: 8px;
  background: white;

  .info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }
  .proj-title {
    font-size: 14px;
    font-weight: 700;
    color: #2d3748;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .inviter {
    font-size: 12px;
    color: #a0aec0;
  }
  .actions {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }
  button {
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: 0.2s;
  }
  button.accept {
    background: #28b4ad;
    color: white;
  }
  button.accept:hover { background: #219992; }
  button.reject {
    background: #edf2f7;
    color: #4a5568;
  }
  button.reject:hover { background: #e2e8f0; }
`;

const HistoryModalContent = styled(ModalContent)`
  width: 500px;
  max-width: 90vw;
  padding: 24px;
  display: flex;
  flex-direction: column;
  max-height: 80vh;
`;

const HistoryHeaderRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-shrink: 0;
`;

const SortToggleBtn = styled.button`
  background: #f1f3f5;
  border: 1px solid #cbd5e0;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  color: #4a5568;
  cursor: pointer;
  transition: all 0.2s;
  &:hover {
    background: #e2e8f0;
  }
`;

const HistoryListWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  padding-right: 4px;
  flex: 1;

  -ms-overflow-style: none;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const EmptyHistory = styled.div`
  text-align: center;
  padding: 40px 0;
  color: #a0aec0;
  font-size: 14px;
  font-weight: 500;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px dashed #cbd5e0;
  line-height: 1.5;
`;

const HistoryItemCard = styled.div`
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.02);
`;

const HistoryItemHeader = styled.div`
  margin-bottom: 10px;
  border-bottom: 1px dashed #e2e8f0;
  padding-bottom: 8px;
  display: flex;
  justify-content: space-between;
`;

const HistoryDate = styled.span`
  font-size: 12px;
  font-weight: 700;
  color: #28b4ad;
`;

const HistoryDescList = styled.ul`
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  color: #4a5568;
  line-height: 1.6;

  li { margin-bottom: 4px; }
`;

const CodeViewerModal = styled(ModalContent)`
  width: 900px;
  max-width: 95vw;
  height: 85vh;
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const CVHeader = styled.div`
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
`;

const CVBody = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
  background: #f8fafd;
`;

const CVLeftSidebar = styled.div`
  width: 250px;
  background: white;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  padding: 16px;
  overflow-y: auto;
  -ms-overflow-style: none;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
`;

const CVSectionTitle = styled.div`
  font-size: 12px;
  font-weight: 700;
  color: #718096;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const CVFileList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const CVFileItem = styled.div<{ $isViewing: boolean }>`
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: 0.2s;
  position: relative;

  background: ${({ $isViewing }) => $isViewing ? '#f0fdfc' : 'transparent'};
  color: ${({ $isViewing }) => $isViewing ? '#28b4ad' : '#4a5568'};
  border: 1px solid ${({ $isViewing }) => $isViewing ? '#28b4ad' : 'rgba(40, 180, 173, 0.3)'};

  ${({ $isViewing }) => $isViewing && css`
    &::before {
      content: '';
      position: absolute;
      left: -1px;
      top: 50%;
      transform: translateY(-50%);
      width: 4px;
      height: 60%;
      background: #28b4ad;
      border-radius: 0 4px 4px 0;
    }
  `}

  &:hover {
    background: ${({ $isViewing }) => $isViewing ? '#e6fcfb' : '#f1f3f5'};
  }
`;

const CVRightArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px;
  overflow-y: auto;
  -ms-overflow-style: none;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
`;

const CVAssignedNodes = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 24px;
`;

const CVNodeBadge = styled.div`
  display: flex;
  align-items: center;
  background: white;
  border: 1px solid #cbd5e0;
  border-radius: 20px;
  padding: 4px 12px 4px 4px;

  .type {
    background: #edf2f7;
    color: #4a5568;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 12px;
    margin-right: 8px;
  }
  .name {
    font-size: 12px;
    font-weight: 600;
    color: #2d3748;
  }
`;

const CVCodeContainer = styled.pre`
  flex: 1;
  margin: 0;
  padding: 16px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 13px;
  color: #2d3748;
  white-space: pre-wrap;
  word-break: break-all;
  overflow-y: auto;

  -ms-overflow-style: none;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
`;

const CloseBtn = styled.button`
  background: #f1f3f5;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  font-size: 16px;
  color: #4a5568;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: 0.2s;

  &:hover {
    background: #e2e8f0;
    color: #1a1a1a;
  }
`;

const toastAnim = keyframes`
  0% { opacity: 0; transform: translate(-50%, 20px); }
  15% { opacity: 1; transform: translate(-50%, 0); }
  85% { opacity: 1; transform: translate(-50%, 0); }
  100% { opacity: 0; transform: translate(-50%, 20px); }
`;

const ToastNotification = styled.div`
  position: fixed;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  background-color: #4a5568;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  z-index: 9999;
  animation: ${toastAnim} 3s ease forwards;
  white-space: pre-wrap;
  word-break: break-all;
  text-align: center;
  max-width: 80vw;
`;