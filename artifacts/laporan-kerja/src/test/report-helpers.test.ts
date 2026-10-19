import { describe, it, expect } from 'vitest';
import { getUnitByCategory, sortByCategory, getReportTasks } from '@/utils/report-helpers';
import { Report } from '@/types/report';

describe('Report Helpers Tests', () => {
  describe('getUnitByCategory', () => {
    it('should return "Pohon" for Tim Pohon category', () => {
      expect(getUnitByCategory('Tim Pohon')).toBe('Pohon');
    });

    it('should return "m2" for other categories', () => {
      expect(getUnitByCategory('Taman Kota')).toBe('m2');
      expect(getUnitByCategory('Tim Babat')).toBe('m2');
      expect(getUnitByCategory('unknown')).toBe('m2');
    });
  });

  describe('sortByCategory', () => {
    it('should sort categories according to categoryOrder', () => {
      const categories = ['Tim Siram', 'Taman Kota', 'Tim Pohon'];
      const sorted = [...categories].sort(sortByCategory);
      expect(sorted).toEqual(['Taman Kota', 'Tim Siram', 'Tim Pohon']);
    });

    it('should put unknown categories at the end', () => {
      const categories = ['Unknown', 'Taman Kota', 'Another Unknown'];
      const sorted = [...categories].sort(sortByCategory);
      expect(sorted[0]).toBe('Taman Kota');
      expect(sorted[1]).toBe('Unknown');
      expect(sorted[2]).toBe('Another Unknown');
    });
  });

  describe('getReportTasks', () => {
    it('should return tasks array if it exists and is not empty', () => {
      const report: Partial<Report> = {
        tasks: [
          { description: 'Task 1', location: { street: 'Street 1', village: [] }, volume: 100, equipment: [], heavyEquipment: [], personnel: { coordinator: 'User', members: 5 } },
          { description: 'Task 2', location: { street: 'Street 2', village: [] }, volume: 200, equipment: [], heavyEquipment: [], personnel: { coordinator: 'User', members: 5 } },
        ],
      };
      const tasks = getReportTasks(report as Report);
      expect(tasks).toHaveLength(2);
      expect(tasks[0].description).toBe('Task 1');
    });

    it('should return empty array if tasks is empty', () => {
      const report: Partial<Report> = {
        tasks: [],
      };
      const tasks = getReportTasks(report as Report);
      expect(tasks).toEqual([]);
    });

    it('should convert legacy task data to task array', () => {
      const report: Partial<Report> = {
        description: 'Legacy task',
        location: { street: 'Legacy street', village: [], subDistrict: '' },
        volume: 150,
      };
      const tasks = getReportTasks(report as Report);
      expect(tasks).toHaveLength(1);
      expect(tasks[0].description).toBe('Legacy task');
      expect(tasks[0].volume).toBe(150);
    });

    it('should return empty array if no legacy data exists', () => {
      const report: Partial<Report> = {};
      const tasks = getReportTasks(report as Report);
      expect(tasks).toEqual([]);
    });
  });
});
