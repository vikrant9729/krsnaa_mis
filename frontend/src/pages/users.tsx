'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '../store/auth';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';
import api from '../api';
import { formatApiError } from '../utils/apiError';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';

const Layout = dynamic(() => import('../components/Layout'), { ssr: false });

interface User {
  id: number;
  username: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export default function Users() {
  const router = useRouter();
  const { isAuthenticated, user: currentUser, hasHydratedAuth } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    password: '',
    role: 'EDITOR',
  });

  useEffect(() => {
    if (!hasHydratedAuth) {
      return;
    }

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    
    if (currentUser?.role !== 'ADMIN') {
      toast.error('Only admins can access this page');
      router.push('/dashboard');
      return;
    }
    
    loadUsers();
  }, [hasHydratedAuth, isAuthenticated, router, currentUser]);

  const loadUsers = async () => {
    try {
      const response = await api.get('/api/users');
      setUsers(response.data);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/auth/register', formData);
      toast.success('User created successfully!');
      setShowModal(false);
      loadUsers();
      setFormData({ username: '', full_name: '', password: '', role: 'EDITOR' });
    } catch (error: any) {
      toast.error(formatApiError(error.response?.data?.detail, 'Failed to create user'));
    }
  };

  const toggleUserStatus = async (userId: number, currentStatus: boolean) => {
    try {
      await api.patch(`/api/users/${userId}`, { is_active: !currentStatus });
      toast.success('User status updated');
      loadUsers();
    } catch (error) {
      toast.error('Failed to update user');
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-red-100 text-red-800';
      case 'MANAGER': return 'bg-purple-100 text-purple-800';
      case 'EDITOR': return 'bg-blue-100 text-blue-800';
      case 'VIEWER': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!hasHydratedAuth || !isAuthenticated) {
    return null;
  }

  return (
    <Layout>
      <div>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">User Management</h1>
            <p className="text-gray-600 mt-1">Manage users and their roles</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <FiPlus className="mr-2" />
            Create User
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-600">Loading users...</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Full Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{user.username}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{user.full_name}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(user.role)}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => toggleUserStatus(user.id, user.is_active)}
                          className="text-blue-600 hover:text-blue-800"
                          title={user.is_active ? 'Deactivate' : 'Activate'}
                        >
                          <FiEdit2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Create User Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-2xl font-bold mb-4">Create User</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="VIEWER">Viewer (Read-only)</option>
                    <option value="EDITOR">Editor (Can edit DOS)</option>
                    <option value="MANAGER">Manager (Can upload, manage)</option>
                    <option value="ADMIN">Admin (Full access)</option>
                  </select>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
                  >
                    Create User
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
