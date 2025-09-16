import { TestBed } from '@angular/core/testing';

import { VtsService } from './vts.service';

describe('VtsService', () => {
  let service: VtsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(VtsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
