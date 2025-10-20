'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Footer from '../components/Footer';
import Header from '../components/Header';
import SkeletonLoader from '../components/SkeletonLoader';
import AddUserModal from '../components/AddUserModal';
import EditUserModal from '../components/EditUserModal';
import DeleteUserModal from '../components/DeleteUserModal';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

import { User, UserRole, CurrentUser, Organization } from './types';


const userRoles: UserRole[] = ['Директор', 'РОП', 'Менеджер', 'Снабженец'];

const clsInput = 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500';

export default function UsersPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/users`, {
        credentials: 'include',
      });
      if (response.ok) {
        const usersData = await response.json();
        setUsers(usersData);
      } else {
        console.error("Failed to fetch users");
        setUsers([]);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const meResponse = await fetch(`${API_BASE_URL}/api/v1/users/me`, {
          credentials: 'include',
        });
        if (meResponse.ok) {
          const userData = await meResponse.json();
          setCurrentUser(userData);
          await fetchUsers();
        } else {
          setCurrentUser(null);
        }
      } catch {
        setCurrentUser(null);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [fetchUsers]);

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      if (currentUser && user.id === currentUser.id) {
        return false;
      }
      const term = searchTerm.toLowerCase();
      const roleMatch = roleFilter ? user.role === roleFilter : true;
      const searchMatch = term
        ? user.login.toLowerCase().includes(term) ||
          user.employee_name.toLowerCase().includes(term) ||
          user.email.toLowerCase().includes(term) ||
          user.organization.company_name.toLowerCase().includes(term)
        : true;
      return roleMatch && searchMatch;
    });
  }, [users, searchTerm, roleFilter, currentUser]);

  const hasAccess = currentUser && (currentUser.role === 'Директор' || currentUser.role === 'РОП');

  const handleUserAdded = () => {
    fetchUsers();
  };

  const handleEditClick = (user: User) => {
    setUserToEdit(user);
  };

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
  };

  const handleCloseModals = () => {
    setUserToEdit(null);
    setUserToDelete(null);
  };

  const handleUserDeleted = async () => {
      if (!userToDelete) return;
      try {
          const response = await fetch(`${API_BASE_URL}/api/v1/users/${userToDelete.id}`, {
              method: 'DELETE',
              credentials: 'include',
          });
          if (response.ok) {
              fetchUsers(); // Refresh user list
              handleCloseModals();
          } else {
              // Handle error
              console.error("Failed to delete user");
              // Maybe show a notification to the user
              handleCloseModals();
          }
      } catch (error) {
          console.error("Error deleting user:", error);
          handleCloseModals();
      }
  };
  
  const handleUserUpdated = () => {
      fetchUsers(); // Refresh user list
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
        <Header />
        <main className="flex-grow container mx-auto px-4 py-8">
          <SkeletonLoader className="h-96 w-full" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
        <Header />
        <main className="flex-grow container mx-auto px-4 py-8">
          <div className="bg-white rounded-xl shadow p-8 text-center">
            <h1 className="text-2xl font-bold text-red-600">Доступ запрещен</h1>
            <p className="text-gray-600 mt-2">У вас нет прав для просмотра этой страницы.</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
        <Header />
        <main className="flex-grow container mx-auto px-4 py-8">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold text-gray-800">Управление пользователями</h1>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="px-5 py-2.5 bg-emerald-600 text-white font-semibold rounded-lg shadow-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition"
              >
                + Добавить пользователя
              </button>
            </div>

            <div className="bg-white p-4 rounded-xl shadow">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label htmlFor="search-filter" className="block text-sm font-medium text-gray-700">Поиск</label>
                  <input
                    type="text"
                    id="search-filter"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Поиск по логину, ФИО, email, компании..."
                    className={clsInput}
                  />
                </div>
                <div>
                  <label htmlFor="role-filter" className="block text-sm font-medium text-gray-700">Роль</label>
                  <select
                    id="role-filter"
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value as UserRole | '')}
                    className={clsInput}
                  >
                    <option value="">Все роли</option>
                    {userRoles.map(role => <option key={role} value={role}>{role}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Сотрудник</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Роль</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Контакты</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Дата регистрации</th>
                    <th scope="col" className="relative px-6 py-3">
                      <span className="sr-only">Действия</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{user.employee_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>{user.email}</div>
                        <div>{user.phone_number}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString('ru-RU')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <button onClick={() => handleEditClick(user)} className="text-amber-600 hover:text-amber-900">Редактировать</button>
                        <button onClick={() => handleDeleteClick(user)} className="text-red-600 hover:text-red-900">Удалить</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredUsers.length === 0 && (
                <div className="text-center py-10 text-gray-500">
                  Пользователи не найдены
                </div>
              )}
            </div>
          </div>
        </main>
        <Footer />
      </div>
      <AddUserModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        currentUser={currentUser as any}
        onUserAdded={handleUserAdded} 
      />
      <EditUserModal
        isOpen={!!userToEdit}
        onClose={handleCloseModals}
        user={userToEdit}
        currentUser={currentUser}
        onUserUpdated={() => {
          handleUserUpdated();
          handleCloseModals();
        }}
      />
      <DeleteUserModal
        isOpen={!!userToDelete}
        onClose={handleCloseModals}
        onConfirm={handleUserDeleted}
        userName={userToDelete?.employee_name || ''}
      />
    </>
  );
}