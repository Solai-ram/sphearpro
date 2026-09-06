import { useState, useCallback, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Filter, Loader2, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import {
  ColumnDef,
  flexRender,
  createCoreRowModel,
  createSortedRowModel,
  createPaginatedRowModel,
  useTable,
  SortingState,
  PaginationState,
  tableFeatures,
  rowSortingFeature,
  rowPaginationFeature,
  stockFeatures,
} from '@tanstack/react-table';
import type { Patient } from '@his-lite/shared-types';
import { fetchApi } from '../../lib/api';

interface PatientsListResponse {
  data: Patient[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const features = tableFeatures({
  ...stockFeatures,
  rowSortingFeature,
  rowPaginationFeature,
  coreRowModel: createCoreRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
});

type PatientsTableFeatures = typeof features;

export function PatientsListPage() {
  const [searchParams] = useSearchParams();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [genderFilter, setGenderFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: page - 1, pageSize: limit });

  const loadPatients = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (page) params.append('page', String(page));
      if (limit) params.append('limit', String(limit));
      if (search) params.append('search', search);
      if (genderFilter) params.append('gender', genderFilter);

      const response = await fetchApi<PatientsListResponse>(`/patients?${params.toString()}`);
      setPatients(response.data);
      setTotal(response.meta.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load patients');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, genderFilter]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const columns: ColumnDef<PatientsTableFeatures, Patient, any>[] = [
    {
      accessorKey: 'patientNumber',
      header: 'Patient #',
      cell: ({ row }) => <span className="font-mono text-sm">{row.getValue('patientNumber')}</span>,
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <Link to={`/patients/${row.original.id}`} className="font-medium text-blue-600 hover:text-blue-500">
          {row.getValue('name')}
        </Link>
      ),
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
    },
    {
      accessorKey: 'email',
      header: 'Email',
    },
    {
      accessorKey: 'gender',
      header: 'Gender',
    },
    {
      accessorKey: 'createdAt',
      header: 'Registered',
      cell: ({ row }) => new Date(row.getValue('createdAt') as string).toLocaleDateString(),
    },
  ];

  const table = useTable<PatientsTableFeatures, Patient>({
    features,
    data: patients,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    manualPagination: true,
    pageCount: Math.ceil(total / limit),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const handleGenderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setGenderFilter(e.target.value);
    setPage(1);
  };

  const resetFilters = () => {
    setSearch('');
    setGenderFilter('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">OP reports</h1>
          <p className="text-gray-500">Manage patient records</p>
        </div>
        <Link to="/patients/new?intent=op" className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          New Patient
        </Link>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center gap-2">
          <Loader2 className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 space-y-4">
        <form onSubmit={handleSearch} className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patients..."
              className="input pl-10"
            />
          </div>

          <select
            value={genderFilter}
            onChange={handleGenderChange}
            className="input lg:w-48"
          >
            <option value="">All Genders</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
            <option value="UNKNOWN">Unknown</option>
          </select>

          <button type="submit" className="btn-secondary">
            <Filter className="w-4 h-4 mr-2" />
            Apply
          </button>

          {(search || genderFilter) && (
            <button type="button" onClick={resetFilters} className="btn-ghost">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Clear
            </button>
          )}
        </form>
      </div>

      {/* List */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={header.column.getToggleSortingHandler()}
                      style={{ width: header.getSize() }}
                    >
                      <div className="flex items-center gap-2">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' && <span className="text-xs">▲</span>}
                        {header.column.getIsSorted() === 'desc' && <span className="text-xs">▼</span>}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-200">
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center text-gray-500">
                    No patients found
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 text-sm text-gray-900">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!isLoading && total > limit && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing {pagination.pageIndex * pagination.pageSize + 1} to{' '}
              {Math.min((pagination.pageIndex + 1) * pagination.pageSize, total)} of {total}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="btn-outline p-2 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-600">Page {page}</span>
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="btn-outline p-2 disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}