import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VesselLoading } from './vessel-loading';

describe('VesselLoading', () => {
  let component: VesselLoading;
  let fixture: ComponentFixture<VesselLoading>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VesselLoading]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VesselLoading);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
