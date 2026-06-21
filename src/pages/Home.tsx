import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styled, { keyframes, css } from 'styled-components';
import logo from '../assets/mainlogo.png';

const BASE_URL = 'http://infragen.kro.kr/api/v1';

interface Project {
  projectId: number;
  title: string;
  description: string;
  status: string;
  createdAt: string;
}

interface ProjectHistory {
  historyId: number;
  versionName: string;
  description: string;
  createdAt: string;
}

export default function Home() {
  const navigate = useNavigate();

  const [userInfo, setUserInfo] = useState({ nickname: '로딩중...', email: '로딩중...', profileImageUrl: '' });
  const [projects, setProjects] = useState<Project[]>([]);
  
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  
  const [editTargetId, setEditTargetId] = useState<number | null>(null);
  const [editNodes, setEditNodes] = useState<any[]>([]);
  const [editEdges, setEditEdges] = useState<any[]>([]);

  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyList, setHistoryList] = useState<ProjectHistory[]>([]);
  const [historySortOrder, setHistorySortOrder] = useState<'desc' | 'asc'>('desc');
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isUserInfoModalOpen, setIsUserInfoModalOpen] = useState(false);
  const [editProfileForm, setEditProfileForm] = useState({ nickname: '', email: '', password: '', passwordConfirm: '' });

  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = () => {
      setMenuOpenId(null);
      setIsProfileMenuOpen(false);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
      navigate('/login');
      return;
    }

    const fetchDashboardData = async () => {
      try {
        const userRes = await fetch(`${BASE_URL}/members/me`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const userData = await userRes.json();
        if (userRes.ok && (userData.isSuccess ?? userData.is_success)) {
          setUserInfo({ 
            nickname: userData.result.nickname, 
            email: userData.result.email,
            profileImageUrl: userData.result.profileImageUrl || '' 
          });
        }

        const projRes = await fetch(`${BASE_URL}/projects`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const projData = await projRes.json();
        
        if (projRes.ok && (projData.isSuccess ?? projData.is_success)) {
          setProjects(projData.result.projectList || []);
        } else if (projRes.status === 401) {
          localStorage.removeItem('accessToken');
          navigate('/login');
        }
      } catch (err) {
        console.error('데이터를 불러오는데 실패했습니다.', err);
      }
    };

    fetchDashboardData();
  }, [navigate]);

  const handleSubmitProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return alert('프로젝트 이름을 입력해주세요.');

    const accessToken = localStorage.getItem('accessToken');

    if (modalMode === 'create') {
      try {
        const res = await fetch(`${BASE_URL}/projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ title: newTitle, description: newDesc }),
        });

        const data = await res.json();
        if (res.ok && (data.isSuccess ?? data.is_success)) {
          setModalMode(null);
          navigate(`/project/${data.result.projectId}`);
        } else {
          alert(data.message || '프로젝트 생성에 실패했습니다.');
        }
      } catch (err) {
        alert('서버 오류가 발생했습니다.');
      }
    } 
    else if (modalMode === 'edit' && editTargetId !== null) {
      try {
        const mappedNodes = editNodes.map((n: any) => ({
          nodeName: n.nodeName,
          componentType: n.componentType,
          positionX: n.positionX,
          positionY: n.positionY,
          properties: n.properties || {}
        }));

        const mappedEdges = editEdges.map((e: any) => {
          const sNode = editNodes.find((n: any) => n.id === e.sourceNodeId);
          const tNode = editNodes.find((n: any) => n.id === e.targetNodeId);
          return {
            sourceNodeName: sNode?.nodeName || '',
            targetNodeName: tNode?.nodeName || ''
          };
        }).filter(e => e.sourceNodeName && e.targetNodeName);

        const res = await fetch(`${BASE_URL}/projects/${editTargetId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({
            title: newTitle,
            description: newDesc,
            nodes: mappedNodes,
            edges: mappedEdges
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
        } else {
          alert(data.message || '프로젝트 수정에 실패했습니다.');
        }
      } catch (err) {
        alert('서버 오류가 발생했습니다.');
      }
    }
  };

  const handleOpenEdit = async (e: React.MouseEvent, proj: Project) => {
    e.stopPropagation();
    setMenuOpenId(null);
    const accessToken = localStorage.getItem('accessToken');

    try {
      const res = await fetch(`${BASE_URL}/projects/${proj.projectId}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await res.json();
      
      if (res.ok && (data.isSuccess ?? data.is_success)) {
        setNewTitle(data.result.title);
        setNewDesc(data.result.description || '');
        setEditNodes(data.result.nodes || []);
        setEditEdges(data.result.edges || []);
        setEditTargetId(proj.projectId);
        setModalMode('edit');
      } else {
        alert('프로젝트 상세 정보를 불러오지 못했습니다.');
      }
    } catch (err) {
      alert('서버 통신 오류가 발생했습니다.');
    }
  };

  const handleDeleteSingle = async (e: React.MouseEvent, projectId: number) => {
    e.stopPropagation();
    setMenuOpenId(null);
    if (!window.confirm('정말 이 프로젝트를 삭제하시겠습니까? 관련 데이터가 모두 삭제됩니다.')) return;

    const accessToken = localStorage.getItem('accessToken');
    try {
      const res = await fetch(`${BASE_URL}/projects/${projectId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) setProjects(projects.filter((p) => p.projectId !== projectId));
      else alert('삭제에 실패했습니다.');
    } catch (err) {
      alert('서버 오류가 발생했습니다.');
    }
  };

  const handleOpenHistory = async (e: React.MouseEvent, projectId: number) => {
    e.stopPropagation();
    setMenuOpenId(null);
    setIsHistoryModalOpen(true);
    setIsHistoryLoading(true);
    setHistorySortOrder('desc'); 
    
    const accessToken = localStorage.getItem('accessToken');
    try {
      const res = await fetch(`${BASE_URL}/projects/${projectId}/histories`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await res.json();
      
      if (res.ok && (data.isSuccess ?? data.is_success)) {
        setHistoryList(data.result?.historyList || []);
      } else {
        setHistoryList([]);
      }
    } catch (err) {
      setHistoryList([]);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`선택한 ${selectedIds.length}개의 프로젝트를 삭제하시겠습니까?\n관련 데이터가 모두 삭제됩니다.`)) return;

    const accessToken = localStorage.getItem('accessToken');
    try {
      await Promise.all(
        selectedIds.map(id =>
          fetch(`${BASE_URL}/projects/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${accessToken}` },
          })
        )
      );
      setProjects(projects.filter(p => !selectedIds.includes(p.projectId)));
      setSelectedIds([]);
      setIsSelectMode(false);
    } catch (err) {
      alert('일부 프로젝트 삭제에 실패했습니다.');
    }
  };

  const handleCardClick = (projectId: number) => {
    if (isSelectMode) {
      setSelectedIds(prev => prev.includes(projectId) ? prev.filter(id => id !== projectId) : [...prev, projectId]);
    } else {
      navigate(`/project/${projectId}`);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    navigate('/login');
  };

  const handleOpenUserInfo = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditProfileForm({ nickname: userInfo.nickname, email: userInfo.email, password: '', passwordConfirm: '' });
    setProfileImageFile(null);
    setProfileImagePreview(null);
    setIsUserInfoModalOpen(true);
    setIsProfileMenuOpen(false);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileImageFile(file);
      setProfileImagePreview(URL.createObjectURL(file));
    }
  };

  const hasProfileChanges = 
    editProfileForm.nickname !== userInfo.nickname || 
    editProfileForm.email !== userInfo.email || 
    editProfileForm.password !== '' ||
    profileImageFile !== null;

  const handleUpdateUserInfo = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasProfileChanges) {
      setIsUserInfoModalOpen(false);
      return;
    }

    if (editProfileForm.password && editProfileForm.password.length < 8) {
      alert('비밀번호는 8자 이상이어야 합니다.');
      return;
    }

    if (editProfileForm.password && editProfileForm.password !== editProfileForm.passwordConfirm) {
      alert('비밀번호가 일치하지 않습니다. 다시 확인해주세요.');
      return;
    }

    const accessToken = localStorage.getItem('accessToken');

    try {
      const formData = new FormData();
      formData.append('nickname', editProfileForm.nickname);
      formData.append('email', editProfileForm.email);
      if (editProfileForm.password) {
        formData.append('password', editProfileForm.password);
      }
      if (profileImageFile) {
        formData.append('profileImage', profileImageFile);
      }

      await fetch(`${BASE_URL}/members/me`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${accessToken}` 
        },
        body: formData
      });

      setUserInfo(prev => ({ 
        ...prev, 
        nickname: editProfileForm.nickname, 
        email: editProfileForm.email,
        profileImageUrl: profileImagePreview || prev.profileImageUrl
      }));
      
      setIsUserInfoModalOpen(false);
      
      setToastMessage('회원정보가 수정되었습니다.');
      setTimeout(() => {
        setToastMessage(null);
      }, 3000);

    } catch (err) {
      console.error('회원정보 수정 실패', err);
      alert('회원정보 수정 중 오류가 발생했습니다.');
    }
  };

  const handleWithdraw = async () => {
    if (!window.confirm('정말 탈퇴하시겠습니까?\n생성된 모든 프로젝트와 정보가 삭제되며 복구할 수 없습니다.')) {
      return;
    }

    const accessToken = localStorage.getItem('accessToken');
    try {
      await fetch(`${BASE_URL}/members/me`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      alert('회원 탈퇴가 완료되었습니다.');
      localStorage.removeItem('accessToken');
      navigate('/login');
    } catch (err) {
      console.error('탈퇴 처리 실패', err);
      alert('탈퇴 처리 중 오류가 발생했습니다.');
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
              {userInfo.profileImageUrl ? (
                <img src={userInfo.profileImageUrl} alt="profile" style={{width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover'}} />
              ) : (
                userInfo.nickname.charAt(0).toUpperCase()
              )}
            </Avatar>
            
            {isProfileMenuOpen && (
              <ProfileDropdown onClick={(e) => e.stopPropagation()}>
                <ProfileAvatarLg style={{ cursor: 'default' }}>
                  {userInfo.profileImageUrl ? (
                    <img src={userInfo.profileImageUrl} alt="profile" style={{width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover'}} />
                  ) : (
                    userInfo.nickname.charAt(0).toUpperCase()
                  )}
                </ProfileAvatarLg>
                <ProfileName>{userInfo.nickname}</ProfileName>
                <ProfileEmail>{userInfo.email}</ProfileEmail>
                
                <ProfileActionRow>
                  <ProfileActionBtn onClick={handleOpenUserInfo}>회원정보</ProfileActionBtn>
                  <ProfileActionBtn className="danger" onClick={handleLogout}>로그아웃</ProfileActionBtn>
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
              {projects.length > 0 && (
                <SelectModeBtn 
                  active={isSelectMode} 
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
                <BulkDeleteBtn onClick={handleBulkDelete}>
                  {selectedIds.length}개 삭제
                </BulkDeleteBtn>
              )}
              <CreateBtn onClick={() => {
                setNewTitle('');
                setNewDesc('');
                setModalMode('create');
              }}>+ 새 프로젝트</CreateBtn>
            </HeaderActions>
          </SectionHeader>

          {projects.length === 0 ? (
            <EmptyState>
              <p>아직 생성된 프로젝트가 없습니다.</p>
              <span>새 프로젝트를 생성하여 인프라 설계를 시작해보세요!</span>
            </EmptyState>
          ) : (
            <Grid>
              {projects.map((proj) => {
                const isSelected = selectedIds.includes(proj.projectId);
                return (
                  <ProjectCard 
                    key={proj.projectId} 
                    onClick={() => handleCardClick(proj.projectId)}
                    isSelected={isSelected}
                    isSelectMode={isSelectMode}
                  >
                    <CardHeader>
                      <ProjectStatus status={proj.status}>{proj.status}</ProjectStatus>
                      
                      {isSelectMode ? (
                        <Checkbox isChecked={isSelected}>
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
                              <DropdownItem onClick={(e) => handleOpenEdit(e, proj)}>수정</DropdownItem>
                              <DropdownItem onClick={(e) => handleOpenHistory(e, proj.projectId)}>활동 기록</DropdownItem>
                              <DropdownItem className="danger" onClick={(e) => handleDeleteSingle(e, proj.projectId)}>삭제</DropdownItem>
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

      {modalMode !== null && (
        <ModalOverlay onClick={() => setModalMode(null)}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalTitle>{modalMode === 'create' ? '새 프로젝트 생성' : '프로젝트 수정'}</ModalTitle>
            <form onSubmit={handleSubmitProject}>
              <InputGroup>
                <label>프로젝트 이름</label>
                <Input
                  autoFocus
                  placeholder="예: My E-commerce Infra"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </InputGroup>
              <InputGroup>
                <label>설명 (선택)</label>
                <TextArea
                  placeholder="프로젝트에 대한 간단한 설명을 적어주세요."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
              </InputGroup>
              <ModalActions style={{ justifyContent: 'flex-end' }}>
                <CancelBtn type="button" onClick={() => setModalMode(null)}>취소</CancelBtn>
                <SubmitBtn type="submit">{modalMode === 'create' ? '생성하기' : '수정하기'}</SubmitBtn>
              </ModalActions>
            </form>
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
                <EmptyHistory>아직 저장된 활동 기록이 없습니다.<br />(에디터에서 수정 후 저장 버튼을 누르세요)</EmptyHistory>
              ) : (
                sortedHistory.map((h) => {
                  const logLines = h.description ? h.description.split('\n') : ['저장되었습니다.'];
                  
                  return (
                    <HistoryItemCard key={h.historyId}>
                      <HistoryItemHeader>
                        <HistoryDate>{formatDateTime(h.createdAt)}에 저장됨</HistoryDate>
                      </HistoryItemHeader>
                      <HistoryDescList>
                        {logLines.map((line, i) => (
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

      {isUserInfoModalOpen && (
        <ModalOverlay onClick={() => setIsUserInfoModalOpen(false)}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalTitle>회원정보 관리</ModalTitle>
            <form onSubmit={handleUpdateUserInfo}>
              
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                <ProfileImageEditWrapper onClick={() => fileInputRef.current?.click()}>
                  {profileImagePreview || userInfo.profileImageUrl ? (
                    <img src={profileImagePreview || userInfo.profileImageUrl} alt="profile" style={{width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover'}} />
                  ) : (
                    <ProfileAvatarLg style={{ marginBottom: 0, width: '100%', height: '100%' }}>
                      {editProfileForm.nickname.charAt(0).toUpperCase() || '?'}
                    </ProfileAvatarLg>
                  )}
                  <CameraOverlay>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                      <circle cx="12" cy="13" r="4"></circle>
                    </svg>
                  </CameraOverlay>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    accept="image/*" 
                    onChange={handleImageChange} 
                  />
                </ProfileImageEditWrapper>
              </div>

              <InputGroup>
                <label>닉네임</label>
                <Input
                  type="text"
                  required
                  placeholder="닉네임 입력"
                  value={editProfileForm.nickname}
                  onChange={(e) => setEditProfileForm({ ...editProfileForm, nickname: e.target.value })}
                />
              </InputGroup>
              <InputGroup>
                <label>이메일</label>
                <Input
                  type="email"
                  required
                  placeholder="이메일 입력"
                  value={editProfileForm.email}
                  onChange={(e) => setEditProfileForm({ ...editProfileForm, email: e.target.value })}
                />
              </InputGroup>
              <InputGroup>
                <label>새 비밀번호</label>
                <Input
                  type="password"
                  placeholder="변경할 비밀번호를 입력하세요 (선택사항, 8자 이상)"
                  value={editProfileForm.password}
                  onChange={(e) => setEditProfileForm({ ...editProfileForm, password: e.target.value })}
                />
              </InputGroup>
              <InputGroup style={{ opacity: editProfileForm.password ? 1 : 0.4, transition: '0.2s' }}>
                <label>새 비밀번호 확인</label>
                <Input
                  type="password"
                  placeholder="비밀번호를 다시 한 번 입력하세요"
                  value={editProfileForm.passwordConfirm}
                  onChange={(e) => setEditProfileForm({ ...editProfileForm, passwordConfirm: e.target.value })}
                  disabled={!editProfileForm.password}
                />
              </InputGroup>
              
              <ModalActions style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <WithdrawBtn type="button" onClick={handleWithdraw}>회원 탈퇴</WithdrawBtn>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <CancelBtn type="button" onClick={() => setIsUserInfoModalOpen(false)}>취소</CancelBtn>
                  <SubmitBtn type="submit">{hasProfileChanges ? '저장하기' : '확인'}</SubmitBtn>
                </div>
              </ModalActions>
            </form>
          </ModalContent>
        </ModalOverlay>
      )}

      {toastMessage && <ToastNotification>{toastMessage}</ToastNotification>}

    </PageContainer>
  );
}


const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const toastAnimation = keyframes`
  0% { opacity: 0; transform: translate(-50%, 20px); }
  15% { opacity: 1; transform: translate(-50%, 0); }
  85% { opacity: 1; transform: translate(-50%, 0); }
  100% { opacity: 0; transform: translate(-50%, 20px); }
`;

const PageContainer = styled.div`
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f8fafd;
  font-family: 'Inter', 'Pretendard', sans-serif;
`;

const Header = styled.header`
  height: 64px;
  background: white;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 40px;
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

const ProfileImageEditWrapper = styled.div`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  position: relative;
  cursor: pointer;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  
  &:hover > div {
    opacity: 1;
  }
`;

const CameraOverlay = styled.div`
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
  border-radius: 50%;
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
  margin-bottom: 24px;
  text-align: center;
  word-break: break-all;
  width: 100%;
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

  &:hover {
    background: #f8f9fa;
  }

  &.danger {
    color: #e53e3e;
    &:hover {
      background: #fff5f5;
      border-color: #fc8181;
    }
  }
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
`;

const SelectModeBtn = styled.button<{ active: boolean }>`
  background: ${({ active }) => active ? '#edf2f7' : 'white'};
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

const ProjectCard = styled.div<{ isSelected: boolean; isSelectMode: boolean }>`
  background: white;
  border-radius: 12px;
  padding: 20px;
  border: 2px solid ${({ isSelected }) => isSelected ? '#28b4ad' : '#e2e8f0'};
  box-shadow: 0 4px 6px rgba(0,0,0,0.02);
  cursor: pointer;
  transition: all 0.2s;
  animation: ${fadeIn} 0.3s ease-out;
  display: flex;
  flex-direction: column;
  position: relative;

  ${({ isSelected }) => isSelected && css`background: #f0fdfc;`}

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 10px 20px rgba(0,0,0,0.06);
    ${({ isSelectMode, isSelected }) => !isSelectMode && !isSelected && css`border-color: #a0aec0;`}
  }
`;

const Checkbox = styled.div<{ isChecked: boolean }>`
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid ${({ isChecked }) => isChecked ? '#28b4ad' : '#cbd5e0'};
  background: ${({ isChecked }) => isChecked ? '#28b4ad' : 'white'};
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

const ProjectStatus = styled.span<{ status: string }>`
  font-size: 11px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 6px;
  background: ${({ status }) => status === 'DRAFT' ? '#edf2f7' : '#e6fffa'};
  color: ${({ status }) => status === 'DRAFT' ? '#4a5568' : '#234e52'};
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
  
  &:hover {
    background: #edf2f7;
    color: #4a5568;
  }
`;

const DropdownMenu = styled.div`
  position: absolute;
  top: 32px;
  right: 0;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  width: 120px;
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

  &:hover {
    background: #f8f9fa;
  }

  &.danger {
    color: #e53e3e;
    &:hover {
      background: #fff5f5;
    }
  }
`;

const ProjectTitle = styled.h3`
  font-size: 18px;
  margin: 0 0 8px 0;
  color: #2d3748;
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

const HistoryModalContent = styled(ModalContent)`
  width: 440px;
  max-width: 90vw;
  padding: 24px;
  display: flex;
  flex-direction: column;
`;

const HistoryHeaderRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
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
  max-height: 400px;
  overflow-y: auto;
  padding-right: 4px;

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
  
  li {
    margin-bottom: 4px;
  }
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
  animation: ${toastAnimation} 3s ease forwards;
`;